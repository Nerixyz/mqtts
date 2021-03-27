import {
    ExecuteDelayed,
    ExecutePeriodically,
    IncomingListenMessage,
    ListenOptions,
    ListenSubscribeOptions,
    MqttAutoReconnectOptions,
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
import {
    ConnectRequestOptions,
    ConnectResponsePacket,
    DefaultPacketReadMap,
    DefaultPacketReadResultMap,
    DefaultPacketWriteOptions,
    PacketReadMap,
    PacketReadResultMap,
    PacketWriteOptionsMap,
    PacketWriter,
    PublishRequestPacket,
    SubscribeReturnCode,
} from './packets';
import { MqttMessageOutgoing } from './mqtt.message';
import { AbortError, ConnectError, FlowStoppedError, IllegalStateError, UnexpectedPacketError } from './errors';
import { pipeline, Writable } from 'stream';
import { EventMapping, PacketType, packetTypeToString } from './mqtt.constants';
import { MqttBaseClient } from './mqtt.base-client';
import { HandlerFn, MqttListener, RemoveHandlerFn } from './mqtt.listener';
import { createDefaultPacketLogger, createFlowCounter, stringifyObject, toMqttTopicFilter } from './mqtt.utilities';
import debug = require('debug');

export class MqttClient<
    ReadMap extends PacketReadResultMap = DefaultPacketReadResultMap,
    WriteMap extends PacketWriteOptionsMap = DefaultPacketWriteOptions
> extends MqttBaseClient<ReadMap, WriteMap> {
    private mqttDebug = debug('mqtt:client');
    private receiveDebug = this.mqttDebug.extend('packet');
    private pingDebug = this.mqttDebug.extend('ping');
    // wrapper functions
    protected executePeriodically: ExecutePeriodically = (ms, cb) => setInterval(cb, ms);
    protected stopExecuting: StopExecuting = clearInterval;
    protected executeDelayed: ExecuteDelayed = (ms, cb) => setTimeout(cb, ms);
    protected flowCounter = createFlowCounter();

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
    protected createTransformer: () => MqttTransformer<ReadMap>;
    protected pipeline?: Writable;

    protected writer: PacketWriter<WriteMap>;

    protected keepAliveTimer?: TimerRef;

    protected autoReconnect?: boolean | MqttAutoReconnectOptions;
    protected reconnectAttempt = 1;

    protected activeFlows: PacketFlowData<any>[] = [];

    protected messageListener = new MqttListener();

    constructor(options: MqttClientConstructorOptions<ReadMap, WriteMap>) {
        super();
        this.autoReconnect = options.autoReconnect;
        this.transport =
            options.transport ??
            new TlsTransport({
                host: options.host,
                port: options.port,
                additionalOptions: {
                    enableTrace: options.enableTrace,
                },
            });
        this.createTransformer =
            options.createTransformer ??
            (() =>
                new MqttTransformer<ReadMap>({
                    debug: this.mqttDebug.extend('transformer'),
                    mapping: options.readMap ?? (DefaultPacketReadMap as PacketReadMap<ReadMap>),
                }));
        this.transformer = this.createTransformer();
        this.transformer.options.debug ??= this.mqttDebug.extend('transformer');
        const packetLogger = this.mqttDebug.extend('write');
        this.writer =
            options.packetWriter ??
            new PacketWriter<WriteMap>(
                {
                    logPacketWrite: createDefaultPacketLogger(packetLogger),
                },
                options.writeMap,
            );
    }

    private async _connect(
        options?: Resolvable<RegisterClientOptions>,
    ): Promise<undefined | Error | string | ConnectResponsePacket> {
        this.expectCreated();
        this.mqttDebug(`Connecting using transport "${this.transport.constructor.name}"`);
        this.connectResolver = options;
        this.setConnecting();
        try {
            await this.transport.connect();
        } catch (e) {
            this.mqttDebug(`Transport connect error ("${this.transport.constructor.name}")`, e.message);
            const shouldReconnect = this.shouldReconnect();
            await this.setDisconnected(e);
            if (shouldReconnect) {
                return;
            } else {
                throw e;
            }
        }

        this.createPipeline();

        return this.registerClient(await this.resolveConnectOptions());
    }

    public async connect(options?: Resolvable<RegisterClientOptions>) {
        try {
            await this._connect(options);
        } catch (e) {
            this.mqttDebug(`Connection error`, e);
            this.emitError(e);
        }
    }

    protected createPipeline() {
        if (!this.transport.duplex) throw new IllegalStateError('Expected transport to expose a Duplex.');

        this.pipeline = pipeline(
            this.transport.duplex,
            this.transformer,
            (async (source: AsyncIterable<MqttParseResult<ReadMap, PacketType>>) => {
                for await (const chunk of source) {
                    if (!chunk.type) {
                        throw new Error('Chunk is not a MqttPacket');
                    }
                    await this.handlePacket(chunk);
                }
                return 'Source drained';
            }) as any /* bad definitions */,
            err => {
                if (err) this.emitError(err);
                if (!this.disconnected) {
                    (err ? this.setDisconnected(err) : this.setDisconnected('Pipeline finished')).catch(e =>
                        this.emitWarning(e),
                    );
                }
            },
        );
    }

    public publish(message: MqttMessageOutgoing): Promise<MqttMessageOutgoing> {
        return this.startFlow(outgoingPublishFlow(message) as PacketFlowFunc<ReadMap, WriteMap, MqttMessageOutgoing>);
    }

    public subscribe(subscription: MqttSubscription): Promise<SubscribeReturnCode> {
        return this.startFlow(
            outgoingSubscribeFlow(subscription) as PacketFlowFunc<ReadMap, WriteMap, SubscribeReturnCode>,
        );
    }

    public unsubscribe(subscription: MqttSubscription): Promise<void> {
        return this.startFlow(outgoingUnsubscribeFlow(subscription) as PacketFlowFunc<ReadMap, WriteMap, void>);
    }

    public async disconnect(force = false): Promise<void> {
        this.autoReconnect = false;
        if (!force) {
            return this.startFlow(outgoingDisconnectFlow() as PacketFlowFunc<ReadMap, WriteMap, void>).then(
                async () => {
                    await this.setDisconnected();
                },
            );
        } else {
            await this.setDisconnected('Forced Disconnect');
        }
    }

    public listenSubscribe<T = IncomingListenMessage>(topic: string, handlerFn: HandlerFn<T>): Promise<RemoveHandlerFn>;
    public listenSubscribe<T = IncomingListenMessage, Params extends Record<string, string> = Record<string, string>>(
        options: ListenSubscribeOptions<T, Params>,
        handlerFn: HandlerFn<T>,
    ): Promise<RemoveHandlerFn>;
    public listenSubscribe<T = IncomingListenMessage, Params extends Record<string, string> = Record<string, string>>(
        options: string | ListenSubscribeOptions<T, Params>,
        handlerFn: HandlerFn<T>,
    ): Promise<RemoveHandlerFn> {
        const listener = typeof options === 'string' ? { topic: options } : options;
        return this.subscribe({
            ...listener.subscriptionInfo,
            topic: listener.topic.replace(/\/:[A-Za-z-_0-9]+/g, '/+'),
        }).then(() => this.listen(listener, handlerFn));
    }

    public listen<T>(topic: string, handlerFn: HandlerFn<T>): RemoveHandlerFn;
    public listen<T, Params extends Record<string, string>>(
        options: ListenOptions<T, Params>,
        handlerFn: HandlerFn<T>,
    ): RemoveHandlerFn;
    public listen<T, Params extends Record<string, string>>(
        options: string | ListenOptions<T, Params>,
        handlerFn: HandlerFn<T>,
    ): RemoveHandlerFn {
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

    public startFlow<T>(flow: PacketFlowFunc<ReadMap, WriteMap, T>): Promise<T> & { flowId: bigint | number } {
        const flowId = this.flowCounter.next();
        const promise = new Promise<T>((resolve, reject) => {
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
                flowId,
                flowFunc: flow,
            };
            const first = data.callbacks.start();
            if (first) this.sendData(this.writer.write(first.type, first.options));

            if (!data.finished) {
                this.activeFlows.push(data);
            }
        });
        (promise as any).flowId = flowId;
        return promise as Promise<T> & { flowId: bigint | number };
    }

    public stopFlow(flowId: bigint | number, rejection?: Error): boolean {
        const flow = this.getFlowById(flowId);
        if (!flow) return false;

        this.activeFlows = this.activeFlows.filter(f => f.flowId !== flowId);

        flow.finished = true;
        flow.resolvers.reject(rejection ?? new FlowStoppedError());

        return true;
    }

    /**
     *  Run the accept and next function of all active flows
     * @param packet
     * @returns true if a flow has been found
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

    protected stopExecutingFlows(error: Error) {
        for (const flow of this.activeFlows) {
            flow.resolvers.reject(error);
            flow.finished = true;
        }
        this.activeFlows = [];
    }

    protected getFlowById<T = any>(id: number | bigint): PacketFlowData<T> | undefined {
        return this.activeFlows.find(f => f.flowId === id);
    }

    protected registerClient(options: RegisterClientOptions): Promise<any> {
        const flow = this.getConnectFlow(options);
        const connectPromiseFlow = this.startFlow(flow);

        if (typeof options.connectDelay !== 'undefined') {
            const timerId = this.executeDelayed(options.connectDelay ?? 2000, () => {
                const flow = this.getFlowById(connectPromiseFlow.flowId);
                if (!flow) {
                    // there's no flow anymore
                    this.stopExecuting(timerId);
                    return;
                }
                const packet = flow.callbacks.start();
                if (packet) this.sendData(this.writer.write(packet.type, packet.options));
            });
            connectPromiseFlow
                .finally(() => this.stopExecuting(timerId))
                // not sure why this is necessary, but it's there so no unhandledRejection is thrown
                .catch(() => undefined);
        }

        options.signal?.addEventListener('abort', () =>
            this.stopFlow(connectPromiseFlow.flowId, new AbortError('Connecting aborted')),
        );

        return connectPromiseFlow;
    }

    protected getConnectFlow(options: ConnectRequestOptions): PacketFlowFunc<ReadMap, WriteMap, unknown> {
        // assume the defaults are used
        return outgoingConnectFlow(options) as PacketFlowFunc<ReadMap, WriteMap, unknown>;
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
                .catch(e => {
                    this.emitWarning(e);
                    this.pingDebug(`PingPong failed. (${e.message})`);
                });
        });
    }

    protected sendData(data: Buffer): void {
        if (!this.transport.duplex) throw new IllegalStateError('Expected a duplex - was undefined');

        this.transport.duplex.write(data);
    }

    protected async handlePacket(packet: MqttParseResult<ReadMap, PacketType>): Promise<void> {
        this.logReceivedPacket(packet);
        this.emit(PacketType[packet.type].toUpperCase() as keyof EventMapping, packet.data);

        let forceCheckFlows = false;
        // The following "type assertions" are valid as clients extending MqttClient have to implement their own methods
        switch (packet.type) {
            case PacketType.ConnAck: {
                this.onConnAck((packet as MqttParseResult<DefaultPacketReadResultMap, PacketType.ConnAck>).data);
                break;
            }
            case PacketType.Publish: {
                this.onPublish((packet as MqttParseResult<DefaultPacketReadResultMap, PacketType.Publish>).data);
                break;
            }
            case PacketType.Disconnect: {
                this.setDisconnected('disconnect packet received').catch(e => this.emitWarning(e));
                break;
            }
            default:
                forceCheckFlows = true;
        }
        if (!this.continueFlows(packet) && forceCheckFlows) {
            this.emitWarning(new UnexpectedPacketError(packetTypeToString(packet.type)));
        }
    }

    protected onConnAck(connAck: ConnectResponsePacket) {
        if (connAck.isSuccess) {
            this.setReady();
            this.emitConnect(connAck);
            if (this.connectOptions?.keepAlive) {
                this.updateKeepAlive(this.connectOptions.keepAlive);
            }
            if (typeof this.autoReconnect === 'object' && this.autoReconnect.resetOnConnect) this.reconnectAttempt = 1;
        } else {
            this.setFatal();
            this.emitError(new ConnectError(connAck.errorName));
            this.setDisconnected(connAck.errorName).catch(e => this.emitWarning(e));
        }
    }

    protected onPublish(publish: PublishRequestPacket) {
        this.startFlow(
            incomingPublishFlow(
                {
                    topic: publish.topic,
                    payload: publish.payload,
                    qosLevel: publish.qos,
                    retained: publish.retain,
                    duplicate: publish.duplicate,
                },
                publish.identifier ?? undefined,
            ) as PacketFlowFunc<ReadMap, WriteMap, any>,
        )
            .then(async m => {
                this.emitMessage(m);
                await this.messageListener.handleMessage(m);
            })
            .catch(e => this.emitWarning(e));
    }

    protected logReceivedPacket(packet: { type: PacketType; data: any }): void {
        if (packet.type !== PacketType.PingReq && packet.type !== PacketType.PingResp)
            this.receiveDebug(`Received ${stringifyObject(packet.data)}`);
    }

    protected reset(): void {
        super.reset();

        this.stopExecutingFlows(new AbortError('Resetting'));

        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = undefined;
        }

        this.transformer.reset();
    }

    protected setReady(): void {
        super.setReady();
        this.mqttDebug('Ready!');
    }

    protected shouldReconnect(): boolean {
        if (!this.autoReconnect)
            // this should never be true
            return false;
        if (typeof this.autoReconnect === 'boolean') {
            return this.autoReconnect;
        }

        return this.reconnectAttempt <= (this.autoReconnect.maxReconnectAttempts ?? 1);
    }

    protected async reconnect() {
        this.transport.reset();
        this.transformer = this.createTransformer();
        this.transformer.options.debug = this.transformer.options.debug ?? this.mqttDebug.extend('transformer');
        await this.connect();
    }
    protected async setDisconnected(reason?: string | Error) {
        const willReconnect = this.shouldReconnect();
        this.mqttDebug(`Disconnected. Will reconnect: ${willReconnect}. Reconnect attempt #${this.reconnectAttempt}`);
        this.reconnectAttempt++; // this should range from 1 to maxAttempts + 1 when shouldReconnect() is called
        this.stopExecutingFlows(new AbortError('Client disconnected.'));

        this._setDisconnected();
        this.emitDisconnect({ reason, reconnect: willReconnect });
        if (this.transport.active) {
            await new Promise<void>(resolve => this.transport.duplex?.end(resolve) ?? /* never */ resolve());
            if (this.transport.duplex && !this.transport.duplex.writableEnded) {
                this.transport.duplex.destroy(new Error('force destroy'));
            }
        }
        this.stopExecuting(this.keepAliveTimer);
        this.reset();
        if (willReconnect) {
            await this.reconnect();
        }
    }
}
