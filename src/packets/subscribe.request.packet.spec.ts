import { assertWritePacket } from '../../test/utilities';
import { writeSubscribePacket } from './subscribe.request.packet';
import { PacketStream } from '../packet-stream';
import { assert } from 'chai';

describe('SubscribeRequestPacket', function () {
    describe('writeSubscribePacket', function () {
        it('should write a minimal packet', function () {
            assertWritePacket(
                writeSubscribePacket,
                {
                    identifier: 2,
                    subscriptions: [{ topic: 'A', qos: 0 }],
                },
                { identifier: 2, flags: 2 },
                '0002',
                '0001',
                '41',
                '00',
            );
        });
        it('should write multiple pairs', function () {
            assertWritePacket(
                writeSubscribePacket,
                {
                    identifier: 2,
                    subscriptions: [
                        { topic: 'A', qos: 0 },
                        { topic: 'B', qos: 1 },
                        { topic: 'C', qos: 2 },
                    ],
                },
                { identifier: 2, flags: 2 },
                '0002',
                '0001',
                '41',
                '00',
                '0001',
                '42',
                '01',
                '0001',
                '43',
                '02',
            );
        });
        it('should throw if subscriptions.length = 0', function () {
            assert.throws(() =>
                writeSubscribePacket(PacketStream.empty(), {
                    identifier: 1,
                    subscriptions: [],
                }),
            );
        });
        it('should throw if QoS > 2', function () {
            assert.throws(() =>
                writeSubscribePacket(PacketStream.empty(), {
                    identifier: 1,
                    subscriptions: [{ topic: 'a' }, { qos: 3, topic: 'b' }],
                }),
            );
        });
    });
});
