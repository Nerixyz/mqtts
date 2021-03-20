import { Resolvers } from '../mqtt.utilities';
import { PacketType } from '../mqtt.constants';
import { DefaultPacketReadResultMap, PacketReadResultMap } from '../packets/packet-reader';
import { DefaultPacketWriteOptions, PacketWriteOptionsMap, WriteData } from '../packets/packet-writer';

export type PacketFlowFunc<
    ReadMap extends PacketReadResultMap,
    WriteMap extends PacketWriteOptionsMap,
    TResult,
    TPacket = unknown
> = (
    success: (value: TResult) => void,
    error: (error: Error | string) => void,
) => PacketFlowCallbacks<ReadMap, WriteMap, TPacket>;

export interface PacketFlowCallbacks<
    // TODO: remove in next major version -- would break existing code
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ReadMap extends PacketReadResultMap = DefaultPacketReadResultMap,
    WriteMap extends PacketWriteOptionsMap = DefaultPacketWriteOptions,
    TPacket = unknown
> {
    start(): WriteData<WriteMap, PacketType> | void | undefined | null;
    accept?(packet: TPacket): boolean | undefined;
    next?(last: TPacket): WriteData<WriteMap, PacketType> | void | undefined;
}

export interface PacketFlowData<T> {
    resolvers: Resolvers<T>;
    callbacks: PacketFlowCallbacks;
    finished: boolean;
    flowFunc: unknown;
    flowId: bigint | number;
}
