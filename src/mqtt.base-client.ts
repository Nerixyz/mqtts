import { RegisterClientOptions, Resolvable } from './mqtt.types';
import { resolve } from './mqtt.utilities';
import EventEmitter = require('eventemitter3');
import { PacketReadResultMap } from './packets/packet-reader';
import { PacketWriteOptionsMap } from './packets/packet-writer';
import { MqttMessage } from './mqtt.message';
import { EventMapping, PacketType } from './mqtt.constants';

export enum StateId {
    Fatal = -1,
    Created,
    Connecting,
    Ready,
    Disconnected,
}

// TODO: errors

export class MqttBaseClient<ReadMap extends PacketReadResultMap,
    WriteMap extends PacketWriteOptionsMap> extends EventEmitter<{
    error: (e: Error) => void,
    warning: (e: Error) => void,
    connect: (packet: ReadMap[PacketType.ConnAck]) => void,
    disconnect: (reason?: string) => void,
    message: (message: MqttMessage) => void,
} & { [x in keyof EventMapping]: (arg: ReadMap[EventMapping[x]]) => void }> {

    get current(): StateId {
        return this.sate;
    }
    get created(): boolean {
        return this.current === StateId.Created;
    }
    get fatal(): boolean {
        return this.current === StateId.Fatal;
    }
    get ready(): boolean {
        return this.current === StateId.Ready;
    }
    get connecting(): boolean {
        return this.current === StateId.Connecting;
    }
    // although it might seem weird, this is intended
    // if the client is just created, it's not connected
    get disconnected(): boolean {
        return this.current === StateId.Disconnected || this.current === StateId.Created;
    }

    protected emitWarning = (e: Error) => this.emit('warning', e);
    protected emitError = (e: Error) => this.emit('error', e);
    protected emitDisconnect = (reason?: string) => this.emit('disconnect', reason);
    protected emitConnect = (packet: ReadMap[PacketType.ConnAck]) => this.emit('connect', packet);
    protected emitMessage = (message: MqttMessage) => this.emit('message', message);

    constructor(private sate: StateId = StateId.Created) {
        super();
    }

    private next(newState: StateId) {
        if(newState > this.current && this.current >= 0) {
            this.sate = newState;
        } else {
            throw new Error(`Invalid state requested (current: ${this.current}, requested: ${newState})`);
        }
    }

    public expectReady(): void {
        if(!this.ready) {
            throw new Error(`Expected client to be ready but got ${this.current}`);
        }
    }

    public expectCreated(): void {
        if(!this.created) {
            throw new Error(`Expected client to be created but got ${this.current}`);
        }
    }

    public expectConnecting(): void {
        if(!this.connecting) {
            throw new Error(`Expected client to be connecting but got ${this.current}`);
        }
    }

    protected reset(): void {
        if(this.sate === StateId.Created || this.sate === StateId.Disconnected) {
            this.sate = StateId.Created;
        } else {
            throw new Error(`Invalid state: Resetting requires the client to be Disconnected or Created (current: ${this.current})`);
        }
    }

    protected setConnecting(): void {
        this.next(StateId.Connecting);
    }

    protected setReady(): void {
        this.next(StateId.Ready);
    }

    protected setDisconnected(): void {
        this.next(StateId.Disconnected);
    }

    protected setFatal(): void {
        this.next(StateId.Fatal);
    }

    private _connectResolver?: Resolvable<RegisterClientOptions>;
    private _connectOptions?: RegisterClientOptions;

    set connectOptions(options: RegisterClientOptions | undefined) {
        this._connectOptions = this._connectOptions ?? options;
    }
    get connectOptions(): RegisterClientOptions | undefined {
        return this._connectOptions;
    }

    set connectResolver(resolver: Resolvable<RegisterClientOptions> | undefined) {
        this._connectResolver = this._connectResolver ?? resolver;
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

    private _connectPromise?: Promise<void>;
    private _connectResolve?: () => void;
    private _connectReject?: (e: Error) => void;

    public createConnectPromise() {
        this.expectConnecting();
        if(this._connectPromise) {
            throw new Error('Already created a promise.');
        }
        this._connectPromise = new Promise<void>((resolve, reject) => {
            this._connectResolve = resolve;
            this._connectReject = reject;
        });
        return this._connectPromise;
    }

    public resolveConnectPromise() {
        if(!this._connectResolve)
            throw new Error('No resolver found');
        this._connectResolve();
        this._connectPromise = undefined;
        this._connectResolve = undefined;
        this._connectReject = undefined;
    }

    public rejectConnectPromise(e: Error) {
        if(!this._connectReject)
            throw new Error('No resolver found');
        this._connectReject(e);
        this._connectPromise = undefined;
        this._connectResolve = undefined;
        this._connectReject = undefined;
    }
}
