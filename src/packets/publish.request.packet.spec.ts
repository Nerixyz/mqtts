import { assertPacket, assertWritePacket } from '../../test/utilities';
import { PublishRequestPacket, readPublishRequestPacket, writePublishRequestPacket } from './publish.request.packet';
import { PacketStream } from '../packet-stream';
import { assert } from 'chai';

describe('PublishRequestPacket', function() {
    describe('writePublishRequestPacket', function() {
        it('should write a minimal packet', function() {
            assertWritePacket(writePublishRequestPacket, {
                topic: 'A',
            }, {flags: 0, identifier: undefined}, '0001', '41');
        });
        it('should write the payload', function() {
            assertWritePacket(writePublishRequestPacket, {
                topic: 'A',
                payload: 'B'
            }, {flags: 0, identifier: undefined}, '0001', '41', '42')
        });
        it('should support QoS 1', function() {
            assertWritePacket(writePublishRequestPacket, {
                topic: 'A',
                qos: 1,
                identifier: 1
            }, {flags: 0b0010, identifier: 1}, '0001', '41', '0001')
        });
        it('should support QoS 2', function() {
            assertWritePacket(writePublishRequestPacket, {
                topic: 'A',
                qos: 2,
                identifier: 1
            }, {flags: 0b0100, identifier: 1}, '0001', '41', '0001')
        });
        it('should support QoS with a payload', function() {
            assertWritePacket(writePublishRequestPacket, {
                topic: 'A',
                qos: 1,
                identifier: 1,
                payload: 'B'
            }, {flags: 0b0010, identifier: 1}, '0001', '41', '0001', '42');
            assertWritePacket(writePublishRequestPacket, {
                topic: 'A',
                qos: 2,
                identifier: 1,
                payload: 'B'
            }, {flags: 0b0100, identifier: 1}, '0001', '41', '0001', '42')
        });
        it('should support DUP', function() {
            assertWritePacket(writePublishRequestPacket, {
                topic: 'A',
                duplicate: true,
            }, {flags: 0b1000, identifier: undefined}, '0001', '41');
        });
        it('should support RETAIN', function() {
            assertWritePacket(writePublishRequestPacket, {
                topic: 'A',
                retain: true,
            }, {flags: 0b0001, identifier: undefined}, '0001', '41');
        });
        it('should support DUP QoS and RETAIN together', function() {
            assertWritePacket(writePublishRequestPacket, {
                topic: 'A',
                qos: 2,
                identifier: 1,
                duplicate: true,
                retain: true,
            }, {flags: 0b1101, identifier: 1}, '0001', '41', '0001');
            assertWritePacket(writePublishRequestPacket, {
                topic: 'A',
                qos: 1,
                identifier: 1,
                duplicate: true,
                retain: true,
            }, {flags: 0b1011, identifier: 1}, '0001', '41', '0001');
            assertWritePacket(writePublishRequestPacket, {
                topic: 'A',
                duplicate: true,
                retain: true,
            }, {flags: 0b1001, identifier: undefined}, '0001', '41');
        });
        it('should throw on QoS > 2', function() {
            assert.throws(() => writePublishRequestPacket(PacketStream.empty(), {
                topic: 'A',
                qos: 3
            }));
        });
        it('should throw on QoS > 0 without an identifier', function() {
            assert.throws(() => writePublishRequestPacket(PacketStream.empty(), {
                topic: 'A',
                qos: 1
            }));
            assert.throws(() => writePublishRequestPacket(PacketStream.empty(), {
                topic: 'A',
                qos: 2
            }));
        });
    });

    describe('readPublishRequestPacket', function() {
        it('should read a minimal packet', function() {
            assertPacket(
                readPublishRequestPacket(PacketStream.fromHex('000141'), 3, 0),
                PublishRequestPacket,
                new PublishRequestPacket(0, 'A', undefined, Buffer.alloc(0)));
        });
        it('should read the payload', function() {
            assertPacket(
                readPublishRequestPacket(PacketStream.fromHex('00014142'), 4, 0),
                PublishRequestPacket,
                new PublishRequestPacket(0, 'A', undefined, Buffer.from('42', 'hex')));
        });
        it('should support flags', function() {
            assertPacket(
                readPublishRequestPacket(PacketStream.fromHex('0001410001'), 5, 0b0010),
                PublishRequestPacket,
                new PublishRequestPacket(0b0010, 'A', 1, Buffer.alloc(0)));
        });
        it('should support flags and a payload', function() {
            assertPacket(
                readPublishRequestPacket(PacketStream.fromHex('000141000142'), 6, 0b0100),
                PublishRequestPacket,
                new PublishRequestPacket(0b0100, 'A', 1, Buffer.from('42', 'hex')));
        });
    });
    describe('model', function() {
        describe('flags', function() {
            it('should support flags=0', function() {
                const packet = new PublishRequestPacket(0, '', undefined, Buffer.alloc(0));
                assert.strictEqual(packet.duplicate, false);
                assert.strictEqual(packet.qos, 0);
                assert.strictEqual(packet.retain, false);
            });
            it('should support QoS 1', function() {
                const packet = new PublishRequestPacket(0b0010, '', undefined, Buffer.alloc(0));
                assert.strictEqual(packet.duplicate, false);
                assert.strictEqual(packet.qos, 1);
                assert.strictEqual(packet.retain, false);
            });
            it('should support QoS 2', function() {
                const packet = new PublishRequestPacket(0b0100, '', undefined, Buffer.alloc(0));
                assert.strictEqual(packet.duplicate, false);
                assert.strictEqual(packet.qos, 2);
                assert.strictEqual(packet.retain, false);
            });
            it('should support DUP', function() {
                const packet = new PublishRequestPacket(0b1000, '', undefined, Buffer.alloc(0));
                assert.strictEqual(packet.duplicate, true);
                assert.strictEqual(packet.qos, 0);
                assert.strictEqual(packet.retain, false);
            });
            it('should support RETAIN', function() {
                const packet = new PublishRequestPacket(0b0001, '', undefined, Buffer.alloc(0));
                assert.strictEqual(packet.duplicate, false);
                assert.strictEqual(packet.qos, 0);
                assert.strictEqual(packet.retain, true);
            });
            it('should support DUP QoS ans RETAIN', function() {
                const packet = new PublishRequestPacket(0b1011, '', undefined, Buffer.alloc(0));
                assert.strictEqual(packet.duplicate, true);
                assert.strictEqual(packet.qos, 1);
                assert.strictEqual(packet.retain, true);
                const packet2 = new PublishRequestPacket(0b1101, '', undefined, Buffer.alloc(0));
                assert.strictEqual(packet2.duplicate, true);
                assert.strictEqual(packet2.qos, 2);
                assert.strictEqual(packet2.retain, true);
            });
            it('should throw on QoS > 2', function() {
                assert.throws(() => new PublishRequestPacket(0b0110, '', undefined, Buffer.alloc(0)))
            });
        });
        describe('identifier', function() {
            it('should return -1 if no identifier is used', function() {
                assert.strictEqual(new PublishRequestPacket(0, '', undefined, Buffer.alloc(0)).identifier, -1);
            });
            it('should return the identifier', function() {
                assert.strictEqual(new PublishRequestPacket(0, '', 1, Buffer.alloc(0)).identifier, 1);
            });
        });
    })
});