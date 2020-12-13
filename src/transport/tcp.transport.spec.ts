import { TcpTransport } from './tcp.transport';
import { assertTransportConnectsAndDisconnects } from '../../test/utilities';

describe('TcpTransport', function () {
    it('should connect and disconnect',  async function () {
        await assertTransportConnectsAndDisconnects(new TcpTransport({ host: 'test.mosquitto.org', port: 1883 }));
    });
});
