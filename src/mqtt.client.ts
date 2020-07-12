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
    TimerRef,
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
import { MqttParseResult, MqttTransformer } from './mqtt.parser';
import { TlsTransport, Transport } from './transport';
import { ConnectRequestOptions, SubscribeReturnCode } from './packets';
import { MqttMessageOutgoing } from './mqtt.message';
import { ConnectError, UnexpectedPacketError } from './errors';
import { pipeline, Writable } from 'stream';
import {
    DefaultPacketReadMap,
    DefaultPacketReadResultMap,
    PacketReadMap,
    PacketReadResultMap,
} from './packets/packet-reader';
import {
    DefaultPacketWriteOptions,
    PacketWriteOptionsMap,
    PacketWriter,
} from './packets/packet-writer';
import { PacketType, packetTypeToString } from './mqtt.constants';
import debug = require('debug');
import { MqttBaseClient } from './mqtt.base-client';
import { HandlerFn, MqttListener, RemoveHandlerFn } from './mqtt.listener';
import { toMqttTopicFilter } from './mqtt.utilities';

export class MqttClient<
    ReadMap extends PacketReadResultMap,
    WriteMap extends PacketWriteOptionsMap = DefaultPacketWriteOptions
> extends MqttBaseClient<ReadMap, WriteMap> {
    private mqttDebug = debug('mqtt:client');
    private packetDebug = this.mqttDebug.extend('packet');
    private pingDebug = this.mqttDebug.extend('ping');
    // wrapper functions
    protected executeNextTick: ExecuteNextTick = process.nextTick;
    protected executePeriodically: ExecutePeriodically = (ms, cb) => setInterval(cb, ms);
    protected stopExecuting: StopExecuting = clearInterval;
    protected executeDelayed: ExecuteDelayed = (ms, cb) => setTimeout(cb, ms);

    get keepAlive(): number {
        return this.connectOptions?.keepAlive ?? 0;
    }

    set keepAlive(value: number) {
        if (this.connectOptions) {
            this.connectOptions.keepAlive = value;
            if (value) {
                this.updateKeepAlive(value);
            }
        }
    }

    protected transport: Transport<unknown>;
    protected transformer: MqttTransformer<ReadMap>;

    protected writer: PacketWriter<WriteMap>;

    protected connectTimer?: TimerRef;
    protected keepAliveTimer?: TimerRef;

    protected autoReconnect: boolean;
    protected activeFlows: PacketFlowData<any>[] = [];

    protected messageListener = new MqttListener();

    constructor(options: MqttClientConstructorOptions<ReadMap, WriteMap>) {
        super();
        this.autoReconnect = !!options.autoReconnect;
        this.transport =
            options.transport ??
            new TlsTransport({
                host: options.host,
                port: options.port,
                additionalOptions: {
                    enableTrace: options.enableTrace,
                }
            });
        this.transformer = options.transformer ?? new MqttTransformer<ReadMap>({
            debug: this.mqttDebug.extend('transformer'),
            mapping: options.readMap ?? (DefaultPacketReadMap as PacketReadMap<ReadMap>),
        });
        this.transformer.options.debug = this.transformer.options.debug ?? this.mqttDebug.extend('transformer');
        const packetLogger = this.mqttDebug.extend('write');
        this.writer = options.packetWriter ?? new PacketWriter<WriteMap>({
            logPacketWrite(packetType: PacketType, packetInfo: Record<string, string | number | boolean | undefined>) {
                if (packetType !== PacketType.PingReq && packetType !== PacketType.PingResp) {
                    packetLogger(
                        `Write ${packetTypeToString(packetType)} { ${Object.entries(packetInfo)
                            .filter(([, v]) => typeof v !== 'undefined')
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')}`,
                    );
                }
            },
        }, options.writeMap);
    }

    public async connect(options?: Resolvable<RegisterClientOptions>): Promise<any> {
        this.expectCreated();
        this.mqttDebug('Connecting...');
        this.connectResolver = options;
        this.setConnecting();
        pipeline(
            this.transport.duplex,
            this.transformer,
            new Writable({
                write: (
                    chunk: MqttParseResult<ReadMap, PacketType>,
                    encoding: BufferEncoding,
                    callback: (error?: Error | null) => void,
                ) => {
                    if (!chunk.type) {
                        callback(new Error('Chunk is not a MqttPacket'));
                        return;
                    }

                    this.handlePacket(chunk)
                        .then(() => callback())
                        .catch(callback);
                },
                objectMode: true,
            }),
            err => err && this.emitWarning(err),
        );
        this.transport.duplex.on('close', () => {
            this.setDisconnected('Transport closed.');
        });
        await this.transport.connect();
        return this.registerClient(await this.resolveConnectOptions());
    }

    protected registerClient(
        options: RegisterClientOptions,
        noNewPromise = false,
        lastFlow?: PacketFlowFunc<ReadMap, WriteMap, unknown>): Promise<any> {
        let promise;
        if (noNewPromise) {
            const flow = this.activeFlows.find(x => x.flowId === lastFlow);
            if(!flow){
                promise = Promise.reject(new Error('Could not find flow'));
            } else {
                const packet = flow.callbacks.start();
                if(packet) this.sendData(this.writer.write(packet.type, packet.options));
                promise = Promise.resolve();
            }
        } else {
            promise = this.createConnectPromise();
            lastFlow = lastFlow ?? this.getConnectFlow(options);
            this.startFlow(lastFlow)
                .then(() => this.resolveConnectPromise())
                .catch(e => this.rejectConnectPromise(e));
        }
        this.connectTimer =
            typeof options.connectDelay === 'undefined'
                ? undefined
                : this.executeDelayed(options.connectDelay ?? 2000, () =>
                        // This Promise will only reject if the flow wasn't found
                      this.registerClient(options, true, lastFlow)
                          .catch(e => this.rejectConnectPromise(e)),
                  );
        return promise;
    }

    protected getConnectFlow(options: ConnectRequestOptions): PacketFlowFunc<ReadMap, WriteMap, unknown> {
        // assume the defaults are used
        return outgoingConnectFlow(options) as PacketFlowFunc<ReadMap, WriteMap, unknown>;
    }

    public publish(message: MqttMessageOutgoing): Promise<MqttMessageOutgoing> {
        return this.startFlow(outgoingPublishFlow(message) as PacketFlowFunc<ReadMap, WriteMap, MqttMessageOutgoing>);
    }

    public subscribe(subscription: MqttSubscription): Promise<SubscribeReturnCode> {
        return this.startFlow(outgoingSubscribeFlow(subscription) as PacketFlowFunc<ReadMap, WriteMap, SubscribeReturnCode>);
    }

    public unsubscribe(subscription: MqttSubscription): Promise<void> {
        return this.startFlow(outgoingUnsubscribeFlow(subscription) as PacketFlowFunc<ReadMap, WriteMap, void>);
    }

    public disconnect(force = false): Promise<void> {
        this.autoReconnect = false;
        if(!force) {
            return this.startFlow(outgoingDisconnectFlow() as PacketFlowFunc<ReadMap, WriteMap, void>);
        } else {
            this.setDisconnected('Forced Disconnect');
            return Promise.resolve();
        }
    }

    public listenSubscribe<T = IncomingListenMessage>(topic: string, handlerFn: HandlerFn<T>): Promise<RemoveHandlerFn>;
    public listenSubscribe<T = IncomingListenMessage, Params extends Record<string, string> = Record<string, string>>(
        options: ListenSubscribeOptions<T, Params>, handlerFn: HandlerFn<T>): Promise<RemoveHandlerFn>;
    public listenSubscribe<T = IncomingListenMessage, Params extends Record<string, string> = Record<string, string>>(
        options: string | ListenSubscribeOptions<T, Params>, handlerFn: HandlerFn<T>
    ): Promise<RemoveHandlerFn> {
        const listener = typeof options === 'string' ? { topic: options } : options;
        return this.subscribe({
            ...listener.subscriptionInfo,
            topic: listener.topic.replace(/\/:[A-Za-z-_0-9]+/g, '/+'),
        }).then(() => this.listen(listener, handlerFn));
    }

    public listen<T>(topic: string, handlerFn: HandlerFn<T>): RemoveHandlerFn;
    public listen<T, Params extends Record<string, string>>(options: ListenOptions<T, Params>, handlerFn: HandlerFn<T>): RemoveHandlerFn;
    public listen<T, Params extends Record<string, string>>(options: string | ListenOptions<T, Params>, handlerFn: HandlerFn<T> ): RemoveHandlerFn {
        const listener: ListenOptions<T, Params> = typeof options === 'string' ? { topic: options } : options;
        const [topicFilter, paramMatcher] = toMqttTopicFilter(listener.topic);
        return this.messageListener.addHandler({
            topicFilter,
            handle: handlerFn,
            transformer: listener.transformer,
            validator: listener.validator,
            paramMatcher,
        });
    }

    public startFlow<T>(flow: PacketFlowFunc<ReadMap, WriteMap, T>): Promise<T> {
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
                flowId: flow,
            };
            const first = data.callbacks.start();
            if (first) this.sendData(this.writer.write(first.type, first.options));

            if (!data.finished) {
                this.activeFlows.push(data);
            }
        });
    }

    /**
     *  Run the accept and next function of all active flows
     * @param {MqttPacket} packet
     * @returns {boolean} true if a flow has been found
     */
    protected continueFlows(packet: MqttParseResult<ReadMap, typeof PacketType[keyof typeof PacketType]>): boolean {
        let result = false;
        for (const flow of this.activeFlows) {
            if (flow.callbacks.accept?.(packet.data)) {
                const next = flow.callbacks.next?.(packet.data);
                if (next) {
                    this.sendData(this.writer.write(next.type, next.options));
                }
                result = true;
            }
        }
        this.clearFinishedFlows();
        return result;
    }

    protected clearFinishedFlows(): void {
        this.activeFlows = this.activeFlows.filter(flow => !flow.finished);
    }

    protected updateKeepAlive(value: number): void {
        value = Math.max(value - 0.5, 1);
        if (this.keepAliveTimer) {
            this.stopExecuting(this.keepAliveTimer);
        }
        this.mqttDebug(`Starting keep-alive-ping {delay: ${value}}`);
        this.keepAliveTimer = this.executePeriodically(value * 1000, () => {
            // assume the defaults are used
            this.startFlow(outgoingPingFlow() as PacketFlowFunc<ReadMap, WriteMap, void>)
                .then(() => this.pingDebug(`PingPong @ ${Date.now()}`))
                .catch(() => this.pingDebug('PingPong failed.'));
        });
    }

    protected sendData(data: Buffer): void {
        this.transport.duplex.write(data);
    }

    protected async handlePacket(
        packet: MqttParseResult<ReadMap, PacketType>,
    ): Promise<void> {
        this.logPacket(packet, 'Received');
        let forceCheckFlows = false;
        switch (packet.type) {
            case PacketType.ConnAck: {
                const connack = packet as MqttParseResult<DefaultPacketReadResultMap, PacketType.ConnAck>;
                if (connack.data.isSuccess) {
                    this.setReady();
                    this.emitConnect();
                    if (this.connectOptions?.keepAlive) {
                        this.updateKeepAlive(this.connectOptions.keepAlive);
                    }
                } else {
                    this.setFatal();
                    this.emitError(new ConnectError(connack.data.errorName));
                    this.setDisconnected(connack.data.errorName);
                }
                break;
            }
            case PacketType.Publish: {
                const pub = (packet as MqttParseResult<DefaultPacketReadResultMap, PacketType.Publish>).data;
                this.startFlow(
                    incomingPublishFlow(
                        {
                            topic: pub.topic,
                            payload: pub.payload,
                            qosLevel: pub.qos,
                            retained: pub.retain,
                            duplicate: pub.duplicate,
                        },
                        pub.identifier ?? undefined,
                    ) as PacketFlowFunc<ReadMap, WriteMap, any>,
                )
                    .then(async m => {
                        this.emitMessage(m);
                        await this.messageListener.handleMessage(m);
                    })
                    .catch(e => this.emitWarning(e));
                break;
            }
            case PacketType.Disconnect: {
                // ? this.disconnect();
                this.setDisconnected('disconnect packet received');
                break;
            }
            default:
                forceCheckFlows = true;
        }
        if (!this.continueFlows(packet) && forceCheckFlows) {
            this.emitWarning(new UnexpectedPacketError(packet.constructor.name));
        }
    }

    protected logPacket(packet: { type: PacketType; data: any }, action: string): void {
        if (packet.type !== PacketType.PingReq && packet.type !== PacketType.PingResp)
            this.packetDebug(
                `${action} ${packet.constructor.name}` +
                    (packet.data.identifier ? ` id: ${packet.data.identifier}` : '') +
                    ('topic' in packet.data ? ` topic: ${packet.data.topic}` : ''),
            );
    }

    protected reset(): void {
        super.reset();
        if (this.connecting) this.rejectConnectPromise(new Error('Disconnected'));
        if (this.connectTimer) clearTimeout(this.connectTimer);
        this.connectTimer = undefined;
        if (this.keepAliveTimer) clearInterval(this.keepAliveTimer);
        this.keepAliveTimer = undefined;
        this.activeFlows = [];
        this.transformer.reset();
    }

    protected setReady(): void {
        super.setReady()
        this.mqttDebug('Ready!');
        if (this.connectTimer) this.stopExecuting(this.connectTimer);
    }

    protected setDisconnected(reason?: string): void {
        const willReconnect =
            !this.disconnected && this.ready && !this.connecting && this.autoReconnect;
        if (this.connecting) this.rejectConnectPromise(new Error('Disconnected'));
        super.setDisconnected();
        this.emitDisconnect(reason);
        !this.transport.duplex.destroyed && this.transport.duplex.destroy();
        this.stopExecuting(this.keepAliveTimer);
        this.reset();
        if (willReconnect) {
            this.connect().catch(e => this.emitError(e));
        }
    }
}
