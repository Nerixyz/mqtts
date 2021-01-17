import { assertWritePacket } from '../../test/utilities';
import { writeUnsubscribePacket } from './unsubscribe.request.packet';
import { assert } from 'chai';
import { PacketStream } from '../packet-stream';

describe('UnsubscribePacketResponse', function () {
    describe('writeUnsubscribeRequestPacket', function () {
        it('should write a minimal packet', function () {
            assertWritePacket(
                writeUnsubscribePacket,
                {
                    identifier: 2,
                    topics: 'A',
                },
                { flags: 2, identifier: 2 },
                '0002',
                '0001',
                '41',
            );
        });
        it('should write multiple topics', function () {
            assertWritePacket(
                writeUnsubscribePacket,
                {
                    identifier: 2,
                    topics: ['A', 'B', 'C'],
                },
                { flags: 2, identifier: 2 },
                '0002',
                '0001',
                '41',
                '0001',
                '42',
                '0001',
                '43',
            );
        });
        it('should throw if topics is empty', function () {
            assert.throws(() =>
                writeUnsubscribePacket(PacketStream.empty(), {
                    identifier: 2,
                    topics: [],
                }),
            );
        });
    });
});
