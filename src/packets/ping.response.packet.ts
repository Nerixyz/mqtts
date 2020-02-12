import { MqttPacket } from '../mqtt.packet';
import { PacketTypes } from '../mqtt.constants';

export class PingResponsePacket extends MqttPacket {
    public constructor() {
        super(PacketTypes.TYPE_PINGRESP);
    }
}
