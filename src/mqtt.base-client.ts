import { RegisterClientOptions, Resolvable } from './mqtt.types';
import { resolve } from './mqtt.utilities';
import { PacketWriteOptionsMap, PacketReadResultMap } from './packets';
import { MqttMessage } from './mqtt.message';
import { EventMapping, PacketType } from './mqtt.constants';
import { EventEmitter } from 'eventemitter3';

export enum StateId {
    Created,
    Connecting,
    Ready,
    Disconnected,
}

// TODO: errors

export class MqttBaseClient<
    ReadMap extends PacketReadResultMap,
    // TODO: fix in next major version -- would break existing code
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    WriteMap extends PacketWriteOptionsMap,
> extends EventEmitter<
    {
        error: (e: Error) => void;
        warning: (e: Error) => void;
        connect: (packet: ReadMap[PacketType.ConnAck]) => void;
        disconnect: (event?: { reason?: string | Error; reconnect: boolean }) => void;
        message: (message: MqttMessage) => void;
    } & { [x in keyof EventMapping]: (arg: ReadMap[EventMapping[x]]) => void }
> {
    constructor(private sate: StateId = StateId.Created) {
        super();
    }

    get current(): StateId {
        return this.sate;
    }

    get created(): boolean {
        return this.current === StateId.Created;
    }

    get ready(): boolean {
        return this.current === StateId.Ready;
    }

    // although it might seem weird, this is intended

    get connecting(): boolean {
        return this.current === StateId.Connecting;
    }

    // if the client is just created, it's not connected
    get disconnected(): boolean {
        return this.current === StateId.Disconnected || this.current === StateId.Created;
    }

    private _connectResolver?: Resolvable<RegisterClientOptions>;

    set connectResolver(resolver: Resolvable<RegisterClientOptions> | undefined) {
        this._connectResolver = this._connectResolver ?? resolver;
    }

    private _connectOptions?: RegisterClientOptions;

    get connectOptions(): RegisterClientOptions | undefined {
        return this._connectOptions;
    }

    set connectOptions(options: RegisterClientOptions | undefined) {
        this._connectOptions = this._connectOptions ?? options;
    }

    public expectReady(): void {
        if (!this.ready) {
            throw new Error(`Expected client to be ready but got ${this.current}`);
        }
    }

    public expectCreated(): void {
        if (!this.created) {
            throw new Error(`Expected client to be created but got ${this.current}`);
        }
    }

    public expectConnecting(): void {
        if (!this.connecting) {
            throw new Error(`Expected client to be connecting but got ${this.current}`);
        }
    }

    public hasConnectOptions(): boolean {
        return !!this._connectOptions;
    }

    public async resolveConnectOptions(): Promise<RegisterClientOptions> {
        this._connectOptions = {
            ...this._connectOptions,
            ...(this._connectResolver ? await resolve(this._connectResolver) : {}),
        };
        return this._connectOptions;
    }

    protected emitWarning = (e: Error) => this.emit('warning', e);

    protected emitError = (e: Error) => this.emit('error', e);

    protected emitDisconnect = (event: { reason?: string | Error; reconnect: boolean }) =>
        this.emit('disconnect', event);

    protected emitConnect = (packet: ReadMap[PacketType.ConnAck]) => this.emit('connect', packet);

    protected emitMessage = (message: MqttMessage) => this.emit('message', message);

    protected reset(): void {
        if (this.sate === StateId.Created || this.sate === StateId.Disconnected) {
            this.sate = StateId.Created;
        } else {
            throw new Error(
                `Invalid state: Resetting requires the client to be Disconnected or Created (current: ${this.current})`,
            );
        }
    }

    protected setConnecting(): void {
        this.next(StateId.Connecting);
    }

    protected setReady(): void {
        this.next(StateId.Ready);
    }

    protected _setDisconnected(): void {
        this.next(StateId.Disconnected);
    }

    private next(newState: StateId) {
        if (newState > this.current) {
            this.sate = newState;
        } else {
            throw new Error(`Invalid state requested (current: ${this.current}, requested: ${newState})`);
        }
    }
}
