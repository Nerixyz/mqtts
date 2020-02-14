import { MqttPacket } from '../mqtt.packet';
import { Resolvers } from '../mqtt.utilities';

export type PacketFlowFunc<T> = (
    success: (value: T) => void,
    error: (error: Error | string) => void,
) => PacketFlowCallbacks;

export interface PacketFlowCallbacks {
    start(): MqttPacket | void | undefined | null;
    accept?(packet: MqttPacket): boolean | undefined | null;
    next?(last: MqttPacket): MqttPacket | void | undefined | null;
}

export interface PacketFlowData<T> {
    resolvers: Resolvers<T>;
    callbacks: PacketFlowCallbacks;
    finished: boolean;
}
