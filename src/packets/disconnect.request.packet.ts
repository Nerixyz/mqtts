import { MqttPacket } from '../mqtt.packet';
import { PacketTypes } from '../mqtt.constants';

export class DisconnectRequestPacket extends MqttPacket {
    public constructor() {
        super(PacketTypes.TYPE_DISCONNECT);
    }
}
