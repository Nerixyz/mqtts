import { Observable, Subject } from 'rxjs';
import {
    ExecuteDelayed,
    ExecuteNextTick,
    ExecutePeriodically,
    IncomingListenMessage,
    ListenOptions,
    ListenSubscribeOptions,
    MqttClientConstructorOptions,
    MqttSubscription,
    RegisterClientOptions,
    Resolvable,
    StopExecuting,
} from './mqtt.types';
import {
    incomingPublishFlow,
    outgoingConnectFlow,
    outgoingDisconnectFlow,
    outgoingPingFlow,
    outgoingPublishFlow,
    outgoingSubscribeFlow,
    outgoingUnsubscribeFlow,
    PacketFlowData,
    PacketFlowFunc,
} from './flow';
import { MqttParser } from './mqtt.parser';
import { TlsTransport, Transport } from './transport';
import { MqttPacket } from './mqtt.packet';
import { pull, defaults } from 'lodash';
import { PacketStream } from './packet-stream';
import { PacketTypes } from './mqtt.constants';
import { ConnectResponsePacket, PublishRequestPacket } from './packets';
import { MqttMessage, MqttMessageOutgoing } from './mqtt.message';
import { filter, map } from 'rxjs/operators';
import debug = require('debug');
import { extractParams, matchTopic, resolve } from './mqtt.utilities';
import { UnexpectedPacketError } from './errors';

export class MqttClient {
    private mqttDebug = debug('mqtt:client');
    private packetDebug = this.mqttDebug.extend('packet');
    private pingDebug = this.mqttDebug.extend('ping');
    // wrapper functions
    protected executeNextTick: ExecuteNextTick;
    protected executePeriodically: ExecutePeriodically;
    protected stopExecuting: StopExecuting;
    protected executeDelayed: ExecuteDelayed;

    /**
     * An error has been encountered, the client will no longer work correctly
     * @type {Subject<Error>}
     */
    $error = new Subject<Error>();
    /**
     * An error has been encountered, the client might still continue to work
     * @type {Subject<Error>}
     */
    $warning = new Subject<Error>();
    /**
     *
     * @type {Subject<void>}
     */
    $open = new Subject<void>();
    /**
     * The client successfully established a connection
     * @type {Subject<void>}
     */
    $connect = new Subject<ConnectResponsePacket>();
    /**
     * The client disconnected.
     * @type {Subject<void>}
     */
    $disconnect = new Subject<string | undefined>();
    $message = new Subject<MqttMessage>();

    get keepAlive(): number {
        return this.state?.connectOptions?.keepAlive ?? 0;
    }

    set keepAlive(value) {
        if (this.state?.connectOptions) {
            this.state.connectOptions.keepAlive = value;
            if (value) {
                this.updateKeepAlive(value);
            }
        }
    }

    protected transport: Transport<unknown>;
    protected parser: MqttParser;

    protected connectTimer?: object;
    protected keepAliveTimer?: object;

    protected autoReconnect: boolean;
    protected state: MqttClientState;
    protected activeFlows: PacketFlowData<any>[] = [];

    constructor(options: MqttClientConstructorOptions) {
        this.state = {
            connected: false,
            connecting: false,
            disconnected: false,
        };
        this.autoReconnect = !!options.autoReconnect;
        this.parser = options.parser ?? new MqttParser(e => this.$error.next(e), this.mqttDebug.extend('parser'));
        this.transport =
            options.transport ??
            new TlsTransport({
                url: options.url,
                enableTrace: options.enableTrace ?? false,
                proxyOptions: options.proxyOptions,
            });

        try {
            this.executeNextTick = process.nextTick;
            this.executePeriodically = (ms, cb) => setInterval(cb, ms);
            this.executeDelayed = (ms, cb) => setTimeout(cb, ms);
            this.stopExecuting = clearInterval;
        } catch (e) {
            this.mqttDebug(`Could not register timers: ${e.stack}`);
        }
    }

    public connect(options?: Resolvable<RegisterClientOptions>) {
        if (this.state.connected || this.state.connecting) {
            throw new Error('Invalid State: The client is already connecting/connected!');
        }
        this.mqttDebug('Connecting...');
        this.state.connectOptionsResolver = this.state.connectOptionsResolver ?? options;
        this.setConnecting();
        return new Promise(resolve => {
            this.transport.callbacks = {
                disconnect: (data?: Error) => {
                    if (data) {
                        this.mqttDebug(`Transport disconnected with ${data}\n${data.stack}`);
                        this.$error.next(data);
                    }
                    this.setDisconnected(`error in transport ${data?.name} ${data?.stack}`);
                },
                connect: () => {
                    this.$open.next();
                    resolve();
                },
                error: (e: Error) => this.$error.next(e),
                data: (data: Buffer) => this.parseData(data),
            };

            this.transport.connect();
        }).then(async () => this.registerClient(await this.getConnectOptions()));
    }

    protected async getConnectOptions(): Promise<RegisterClientOptions> {
        return (this.state.connectOptions = defaults(
            await resolve(this.state.connectOptionsResolver || {}),
            this.state.connectOptions ?? {},
        ));
    }

    protected registerClient(options: RegisterClientOptions, noNewPromise = false): Promise<any> {
        let promise;
        if (noNewPromise) {
            promise = this.startFlow(this.getConnectFlow(options));
        } else {
            promise = new Promise<void>((resolve, reject) => {
                this.state.startResolve = resolve;
                this.state.startReject = reject;
            });
            this.startFlow(this.getConnectFlow(options))
                .then(() => this.state.startResolve?.())
                .catch(e => this.state.startReject?.(e));
        }
        this.connectTimer =
            options.connectDelay === null
                ? undefined
                : this.executeDelayed(options.connectDelay ?? 2000, () =>
                      this.registerClient(options, true)
                          .then(() => this.state.startResolve?.())
                          .catch(e => this.state.startReject?.(e)),
                  );
        return promise;
    }

    protected getConnectFlow(options: any): PacketFlowFunc<any> {
        return outgoingConnectFlow(options);
    }

    public publish(message: MqttMessageOutgoing): Promise<MqttMessageOutgoing> {
        return this.startFlow(outgoingPublishFlow(message));
    }

    public subscribe(subscription: MqttSubscription): Promise<MqttSubscription> {
        return this.startFlow(outgoingSubscribeFlow(subscription));
    }

    public unsubscribe(subscription: MqttSubscription): Promise<void> {
        return this.startFlow(outgoingUnsubscribeFlow(subscription));
    }

    public disconnect(): Promise<void> {
        this.autoReconnect = false;
        return this.startFlow(outgoingDisconnectFlow());
    }

    public listenSubscribe<T = IncomingListenMessage<any>>(topic: string): Promise<Observable<T>>;
    public listenSubscribe<T = IncomingListenMessage<any>>(options: ListenSubscribeOptions<T>): Promise<Observable<T>>;
    public listenSubscribe<T = IncomingListenMessage<any>>(
        options: string | ListenSubscribeOptions<T>,
    ): Promise<Observable<T>> {
        const listener = typeof options === 'string' ? { topic: options } : options;
        return this.subscribe({
            ...listener.subscriptionInfo,
            topic: listener.topic.replace(/\/:[A-Za-z-_0-9]+/g, '/+'),
        }).then(() => this.listen(listener));
    }

    public listen<T>(topic: string): Observable<T>;
    public listen<T>(options: ListenOptions<T>): Observable<T>;
    public listen<T>(options: string | ListenOptions<T>): Observable<T> {
        const listener = typeof options === 'string' ? { topic: options } : options;
        const paramRegex = /\/:[A-Za-z-_0-9]+/g;
        let baseTopic = listener.topic;
        if (listener.topic.match(paramRegex)) {
            baseTopic = listener.topic.replace(paramRegex, '/+');
        }
        return this.$message.pipe(
            filter(v => {
                if (!matchTopic(baseTopic, v.topic)) return false;
                if (listener.validator === null) return true;
                if (!listener.validator) {
                    return !!v.payload;
                }
                return listener.validator(v);
            }),
            map((v: IncomingListenMessage<any>) => {
                v.params = extractParams(listener.topic, v.topic);
                return listener.transformer ? listener.transformer(v) : v;
            }),
        ) as Observable<T>;
    }

    public startFlow<T>(flow: PacketFlowFunc<T>): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const data: PacketFlowData<T> = {
                resolvers: { resolve, reject },
                finished: false,
                callbacks: flow(
                    value => {
                        data.finished = true;
                        resolve(value);
                    },
                    err => {
                        data.finished = true;
                        reject(err);
                    },
                ),
            };
            const first = data.callbacks.start();
            if (first) this.sendPacket(first);

            if (!data.finished) {
                this.activeFlows.push(data);
            }
        });
    }

    /**
     *
     * @param {MqttPacket} packet
     * @returns {boolean} true if a flow has been found
     */
    protected continueFlows(packet: MqttPacket): boolean {
        let result = false;
        for (const flow of this.activeFlows) {
            if (flow.callbacks.accept?.(packet)) {
                const next = flow.callbacks.next?.(packet);
                if (next) {
                    this.sendPacket(next);
                }
                result = true;
            }
        }
        this.checkFlows();
        return result;
    }

    protected checkFlows() {
        this.activeFlows = pull(this.activeFlows, ...this.activeFlows.filter(f => f.finished));
    }

    protected updateKeepAlive(value: number) {
        value = Math.max(value - 0.5, 1);
        if (this.keepAliveTimer) {
            this.stopExecuting(this.keepAliveTimer);
        }
        this.mqttDebug(`Starting keep-alive-ping {delay: ${value}}`);
        this.keepAliveTimer = this.executePeriodically(value * 1000, () => {
            this.startFlow(outgoingPingFlow())
                .then(() => this.pingDebug(`PingPong @ ${Date.now()}`))
                .catch(() => this.pingDebug('PingPong failed.'));
        });
    }

    protected sendPacket(packet: MqttPacket) {
        const stream = PacketStream.empty();
        packet.write(stream);
        this.logPacket(packet, 'Sent');
        this.transport.send(stream.data);
    }

    protected async parseData(data: Buffer): Promise<void> {
        try {
            const results = await this.parser.parse(data);
            if (results.length > 0) {
                results.forEach(r => this.handlePacket(r));
            }
        } catch (e) {
            this.$warning.next(e);
        }
    }

    protected async handlePacket(packet: MqttPacket): Promise<void> {
        this.logPacket(packet, 'Received');
        let forceCheckFlows = false;
        switch (packet.packetType) {
            case PacketTypes.TYPE_CONNACK: {
                const connack = packet as ConnectResponsePacket;
                if (connack.isSuccess) {
                    this.setConnected();
                    this.$connect.next(connack);
                    if (this.state?.connectOptions?.keepAlive) {
                        this.updateKeepAlive(this.state.connectOptions.keepAlive);
                    }
                }
                break;
            }
            case PacketTypes.TYPE_PUBLISH: {
                const pub = packet as PublishRequestPacket;
                this.startFlow(
                    incomingPublishFlow(
                        {
                            topic: pub.topic,
                            payload: pub.payload,
                            qosLevel: pub.qosLevel,
                            retained: pub.retained,
                            duplicate: pub.duplicate,
                        },
                        pub.identifier ?? undefined,
                    ),
                )
                    .then(m => this.$message.next(m))
                    .catch(e => this.$warning.next(e));
                break;
            }
            case PacketTypes.TYPE_DISCONNECT: {
                // ? this.disconnect();
                this.setDisconnected('disconnect packet received');
                break;
            }
            default:
                forceCheckFlows = true;
        }
        if (!this.continueFlows(packet) && forceCheckFlows) {
            this.$warning.next(new UnexpectedPacketError(packet.constructor.name));
        }
    }

    protected logPacket(packet: MqttPacket, action: string) {
        if (packet.packetType !== PacketTypes.TYPE_PINGREQ && packet.packetType !== PacketTypes.TYPE_PINGRESP)
            this.packetDebug(
                `${action} ${packet.constructor.name}` +
                    (packet.identifier ? ` id: ${packet.identifier}` : '') +
                    // @ts-ignore - instanceof is too expensive
                    (packet.topic ? ` topic: ${packet.topic}` : ''),
            );
    }

    protected reset() {
        if (this.connectTimer) this.stopExecuting(this.connectTimer);
        this.connectTimer = undefined;
        if (this.keepAliveTimer) this.stopExecuting(this.keepAliveTimer);
        this.keepAliveTimer = undefined;
        this.activeFlows = [];
        this.state.startResolve = undefined;
        this.state.startReject = undefined;
        this.parser.reset();
    }

    protected setConnecting() {
        this.state.connecting = true;
        this.state.connected = false;
        this.state.disconnected = false;
    }

    protected setConnected() {
        this.mqttDebug('Connected!');
        this.state.connecting = false;
        this.state.connected = true;
        this.state.disconnected = false;
        if (this.connectTimer) this.stopExecuting(this.connectTimer);
    }

    protected setDisconnected(reason?: string) {
        const willReconnect =
            !this.state.disconnected && this.state.connected && !this.state.connecting && this.autoReconnect;
        if (!this.state.disconnected) {
            this.$disconnect.next(reason);
        }
        this.transport.disconnect();
        this.state.connecting = false;
        this.state.connected = false;
        this.state.disconnected = true;
        this.stopExecuting(this.keepAliveTimer);
        this.reset();
        if (willReconnect) {
            this.connect().catch(e => this.$error.next(e));
        }
    }
}

export interface MqttClientState {
    connected: boolean;
    connecting: boolean;
    disconnected: boolean;
    connectOptions?: RegisterClientOptions;
    connectOptionsResolver?: Resolvable<RegisterClientOptions>;
    startResolve?: () => void;
    startReject?: (e: any) => void;
}
