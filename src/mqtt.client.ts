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
import { extractParams, matchTopic } from './mqtt.utilities';
import { UnexpectedPacketError } from './errors';

export class MqttClient {
    private mqttDebug = debug('mqtt:client');
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
    $disconnect = new Subject<void>();
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

    protected connectTimer: object;
    protected keepAliveTimer?: object;

    protected state: MqttClientState;
    protected activeFlows: PacketFlowData<any>[] = [];

    constructor(options: MqttClientConstructorOptions) {
        this.state = {
            connected: false,
            connecting: false,
            disconnected: false,
        };
        this.parser = options.parser ?? new MqttParser(e => this.$error.next(e));
        this.transport =
            options.transport ??
            new TlsTransport({
                url: options.url,
                enableTrace: options.enableTrace ?? false,
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

    public connect(options: RegisterClientOptions = {}) {
        if (this.state.connected || this.state.connecting) {
            throw new Error('Invalid State: The client is already connecting/connected!');
        }
        this.mqttDebug('Connecting...');
        this.state.connectOptions = defaults(options, this.state.connectOptions ?? {});
        this.setConnecting();
        return new Promise(resolve => {
            this.transport.callbacks = {
                disconnect: (data?: Error) => {
                    if (data) {
                        this.mqttDebug(`Transport disconnected with ${data}\n${data.stack}`);
                        this.$error.next(data);
                    }
                    this.setDisconnected();
                },
                connect: () => {
                    this.$open.next();
                    resolve();
                },
                error: (e: Error) => this.$error.next(e),
                data: (data: Buffer) => this.parseData(data),
            };

            this.transport.connect();
        }).then(() => this.registerClient(options));
    }

    protected registerClient(options: RegisterClientOptions, noNewPromise = false): Promise<any> {
        let promise;
        if (noNewPromise) {
            promise = this.startFlow(this.getConnectFlow(options));
        } else {
            promise = new Promise<void>(resolve => (this.state.startResolve = resolve));
            this.startFlow(this.getConnectFlow(options)).then(() => this.state.startResolve?.());
        }
        this.connectTimer = this.executeDelayed(2000, () =>
            this.registerClient(options, true).then(() => this.state.startResolve?.()),
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
        return this.startFlow(outgoingDisconnectFlow());
    }

    public listenSubscribe<T>(listener: ListenSubscribeOptions<T>): Promise<Observable<T>> {
        return this.subscribe({
            ...listener.subscriptionInfo,
            topic: listener.topic.replace(/\/:[A-Za-z-_0-9]+/g, '/+'),
        }).then(() => this.listen(listener));
    }

    public listen<T>(listener: ListenOptions<T>): Observable<T> {
        const paramRegex = /\/:[A-Za-z-_0-9]+/g;
        let baseTopic = listener.topic;
        if (listener.topic.match(paramRegex)) {
            baseTopic = listener.topic.replace(paramRegex, '/+');
        }
        // @ts-ignore
        return this.$message
            .pipe(
                filter(v => {
                    if (!matchTopic(baseTopic, v.topic)) return false;
                    if (typeof listener.validator === null) return true;
                    if (!listener.validator) {
                        return v.payload && v.payload.length > 0;
                    }
                    return listener.validator(v);
                }),
            )
            .pipe(
                map(
                    (v: IncomingListenMessage<any>): IncomingListenMessage<any> => {
                        v.params = extractParams(listener.topic, v.topic);
                        return v;
                    },
                ),
            )
            .pipe(map(v => (listener.transformer ?? (x => x))(v)));
    }

    protected startFlow<T>(flow: PacketFlowFunc<T>): Promise<T> {
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
            const pingDebug = this.mqttDebug.extend('ping');
            this.startFlow(outgoingPingFlow())
                .then(() => pingDebug(`PingPong @ ${Date.now()}`))
                .catch(() => pingDebug('PingPong failed.'));
        });
    }

    protected sendPacket(packet: MqttPacket) {
        const stream = PacketStream.empty();
        packet.write(stream);
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
        switch (packet.packetType) {
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
            case PacketTypes.TYPE_CONNACK: {
                this.setConnected();
                this.$connect.next(packet as ConnectResponsePacket);
                if (this.state?.connectOptions?.keepAlive) {
                    this.updateKeepAlive(this.state.connectOptions.keepAlive);
                }
                // no break - continue
            }
            /* eslint no-fallthrough: "off" */
            case PacketTypes.TYPE_PINGRESP:
            case PacketTypes.TYPE_SUBACK:
            case PacketTypes.TYPE_UNSUBACK:
            case PacketTypes.TYPE_PUBREL:
            case PacketTypes.TYPE_PUBACK:
            case PacketTypes.TYPE_PUBREC:
            case PacketTypes.TYPE_PUBCOMP: {
                if (!this.continueFlows(packet)) {
                    this.$warning.next(new UnexpectedPacketError(packet.constructor.name));
                }
                break;
            }
            case PacketTypes.TYPE_DISCONNECT: {
                // ? this.disconnect();
                this.setDisconnected();
                break;
            }
            default: {
                this.$warning.next(
                    new Error(`Cannot handle packet of type ${Object.keys(PacketTypes)[packet.packetType]}`),
                );
            }
        }
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
        this.stopExecuting(this.connectTimer);
    }

    protected setDisconnected() {
        if (!this.state.disconnected) this.$disconnect.next();
        this.state.connecting = false;
        this.state.connected = false;
        this.state.disconnected = true;
        this.stopExecuting(this.keepAliveTimer);
    }
}

export interface MqttClientState {
    connected: boolean;
    connecting: boolean;
    disconnected: boolean;
    connectOptions?: RegisterClientOptions;
    startResolve?: () => void;
}
