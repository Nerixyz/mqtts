import { defaultWrite, PacketWriter } from './packet-writer';
import { PacketType } from '../mqtt.constants';
import { assertBuffer } from '../../test/utilities';
import { assert } from 'chai';

describe('PacketWriter', function () {
    it('should write an empty packet', function () {
        assertBuffer(
            new PacketWriter(
                { logPacketWrite: () => undefined },
                {
                    [PacketType.Connect]: () => {
                        return {};
                    },
                },
            ).write(PacketType.Connect),
            '1000',
        );
    });
    it('should write flags', function () {
        assertBuffer(
            new PacketWriter(
                { logPacketWrite: () => undefined },
                {
                    [PacketType.Connect]: () => {
                        return { flags: 2 };
                    },
                },
            ).write(PacketType.Connect),
            '1200',
        );
    });
    it('should throw on invalid flags', function () {
        assert.throws(() =>
            new PacketWriter(
                { logPacketWrite: () => undefined },
                {
                    [PacketType.Connect]: () => {
                        return { flags: 0xf0 };
                    },
                },
            ).write(PacketType.Connect),
        );
    });
    it('should write a proper remaining length', function () {
        assertBuffer(
            new PacketWriter(
                { logPacketWrite: () => undefined },
                {
                    [PacketType.Connect]: stream => {
                        stream.write(Buffer.from('0123456789abcdef', 'hex'));
                        return {};
                    },
                },
            ).write(PacketType.Connect),
            '10080123456789abcdef',
        );
    });
    it('should throw if there is no function', function () {
        assert.throws(() =>
            new PacketWriter(
                { logPacketWrite: () => undefined },
                {
                    [PacketType.Connect]: undefined,
                },
            ).write(PacketType.Connect),
        );
    });
});

describe('defaultWrite', function () {
    it('should return the arguments as an object', function () {
        const type = PacketType.Connect;
        const options = { clean: true, keepAlive: 60, clientId: '2', protocolLevel: 4, protocolName: 'MQTT' };
        const result = defaultWrite(type, options);
        assert.deepStrictEqual(type, result.type);
        assert.deepStrictEqual(options, result.options);
    });
});
