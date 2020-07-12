import { assertPacket, assertWritePacket } from '../../test/utilities';
import {
    PublishReleasePacket,
    readPublishReleasePacket,
    writePublishReleasePacket,
} from './publish.release.packet';
import { PacketStream } from '../packet-stream';
import { assert } from 'chai';

describe('PublishReleasePacket', function() {
    describe('readPublishReleasePacket', function () {
        it('should read properly', function () {
            assertPacket(
                readPublishReleasePacket(PacketStream.fromHex('000a'), 2),
                PublishReleasePacket,
                new PublishReleasePacket(10),
            );
        });
        it('should fail on invalid remaining length', function () {
            assert.throws(() => readPublishReleasePacket(PacketStream.fromHex('0a'), 1));
        });
    });
    describe('writePublishReleasePacket', function () {
        it('should write', function () {
            assertWritePacket(writePublishReleasePacket, { identifier: 10 }, { identifier: 10, flags: 2 }, '000a');
        });
    });
});