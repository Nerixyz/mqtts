import { ConnectRequestOptions } from './packets';
import { MqttTransformer } from './mqtt.parser';
import { Transport } from './transport';
import { XOR } from 'ts-xor';
import { MqttMessage } from './mqtt.message';
import { DefaultPacketReadResultMap, PacketReadMap, PacketReadResultMap } from './packets/packet-reader';
import {
    DefaultPacketWriteOptions,
    PacketWriteMap,
    PacketWriteOptionsMap,
    PacketWriter,
} from './packets/packet-writer';
import { TransformerFn, ValidatorFn } from './mqtt.listener';
import { MqttsReconnectStrategy } from './reconnect-strategy/mqtts.reconnect-strategy';

export type MqttClientConstructorOptions<
    ReadMap extends PacketReadResultMap = DefaultPacketReadResultMap,
    WriteMap extends PacketWriteOptionsMap = DefaultPacketWriteOptions
> = XOR<{ transport: Transport<unknown> }, { host: string; port: number; enableTrace?: boolean }> & {
    readMap?: PacketReadMap<ReadMap>;
    createTransformer?: () => MqttTransformer<ReadMap>;
    writeMap?: PacketWriteMap<WriteMap>;
    packetWriter?: PacketWriter<WriteMap>;
    autoReconnect?: MqttsReconnectStrategy;
};

export interface MqttAutoReconnectOptions {
    maxReconnectAttempts?: number;
    resetOnConnect?: boolean;
}

export interface MqttSubscription {
    topic: string;
    qosLevel?: number;
}

export type RegisterClientOptions = ConnectRequestOptions;

export type TimerRef = any;
export type ExecutePeriodically = (timeInMs: number, action: () => void) => TimerRef;
export type ExecuteDelayed = (timeInMs: number, action: () => void) => TimerRef;
export type StopExecuting = (ref: TimerRef) => void;

export type AsyncLike<TIn, TOut> = (data: TIn) => TOut | PromiseLike<TOut>;

export interface ListenerInfo<TIn, TOut> {
    eventName: string;
    validator: (data: TIn) => boolean | PromiseLike<boolean>;
    transformer?: (data: TIn) => TOut | PromiseLike<TOut>;
    onData: (data: TOut) => void | PromiseLike<void>;
}

export interface ListenOptions<TOut, Params extends Record<string, string>> {
    topic: string;
    validator?: ValidatorFn<Params>;
    transformer?: TransformerFn<TOut, Params>;
}

export interface ListenSubscribeOptions<TOut, Params extends Record<string, string>>
    extends ListenOptions<TOut, Params> {
    subscriptionInfo?: Partial<MqttSubscription>;
}

export interface IncomingListenMessage<T extends Record<string, string> = Record<string, string>> extends MqttMessage {
    params?: T;
}

export type Resolvable<T extends Record<string, unknown>> = (() => Promise<T>) | (() => T) | T;

export interface IdentifierData {
    identifier: number;
}
