import { assertTransportConnectsAndDisconnects } from '../../test/utilities';
import { SocksTlsTransport } from './socks-tls.transport';

describe('SocksTlsTransport', function() {
    it('should connect and disconnect', async function() {
        await assertTransportConnectsAndDisconnects(new SocksTlsTransport({
            host: 'broker.emqx.io', port: 8883, proxyOptions: {
                type: 5,
                host: '174.76.48.232',
                port: 4145
            },
        }));
    });
});
