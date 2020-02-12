import { MqttPacket } from '../mqtt.packet';
import { PacketTypes } from '../mqtt.constants';

export class PingRequestPacket extends MqttPacket {
    public constructor() {
        super(PacketTypes.TYPE_PINGREQ);
    }
}
