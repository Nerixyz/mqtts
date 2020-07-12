import { writePingRequestPacket } from './ping.request.packet';
import { assertWritePacket } from '../../test/utilities';

describe('PingRequestPacket', function() {
    it('should write nothing', function() {
        assertWritePacket(writePingRequestPacket, {}, {});
    });
})