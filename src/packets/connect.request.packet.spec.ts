import { writeConnectPacket } from './connect.request.packet';
import { assertWritePacket } from '../../test/utilities';
import { assert } from 'chai';
import { PacketStream } from '../packet-stream';
import { MalformedPacketError } from '../errors';

const defaults = {
    protocolName: 'MQTT',
    protocolLevel: 4,
    keepAlive: 60,
    clean: true,
    clientId: 'A',
};

describe('ConnectRequestPacket', function () {
    it('should write a minimal packet', function () {
        assertWritePacket(writeConnectPacket, defaults, {}, '00044', 'd515454', '04', '02', '003c', '0001', '41');
    });
    it('should write a packet with a username', function () {
        assertWritePacket(
            writeConnectPacket,
            {
                ...defaults,
                username: 'B',
            },
            {},
            '00044',
            'd515454',
            '04',
            '82',
            '003c',
            '0001',
            '41',
            '0001',
            '42',
        );
    });
    it('should write a packet with a username and password', function () {
        assertWritePacket(
            writeConnectPacket,
            {
                ...defaults,
                username: 'B',
                password: 'C',
            },
            {},
            '00044',
            'd515454',
            '04',
            'C2',
            '003c',
            '0001',
            '41',
            '0001',
            '42',
            '0001',
            '43',
        );
    });
    it('should write a packet with will', function () {
        assertWritePacket(
            writeConnectPacket,
            {
                ...defaults,
                will: {
                    topic: 'B',
                    message: 'C',
                },
            },
            {},
            '00044',
            'd515454',
            '04',
            '06',
            '003c',
            '0001',
            '41',
            '0001',
            '42',
            '0001',
            '43',
        );
    });
    it('should throw if no username but a password is present', function () {
        assert.throws(
            () =>
                writeConnectPacket(PacketStream.empty(), {
                    ...defaults,
                    password: 'ABC',
                }),
            MalformedPacketError,
        );
    });
});
