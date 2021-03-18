import { Transport } from './transport';
import { TlsTransportOptions } from './tls.transport';
import { SocksClient, SocksProxy } from 'socks';
import duplexify = require('duplexify');
import { connect } from 'tls';
import { Duplexify } from 'duplexify';

export interface SocksTlsTransportOptions extends TlsTransportOptions {
    proxyOptions: SocksProxy;
}

export class SocksTlsTransport extends Transport<SocksTlsTransportOptions> {
    // these will be set on the constructor
    public duplex!: Duplexify;

    constructor(options: SocksTlsTransportOptions) {
        super(options);
        this.reset();
    }

    reset() {
        this.duplex = duplexify(undefined, undefined, { objectMode: true });

        // buffer packets until connect()
        // this.duplex.cork();
    }

    async connect(): Promise<void> {
        const info = await SocksClient.createConnection({
            proxy: this.options.proxyOptions,
            destination: {
                host: this.options.host,
                port: this.options.port,
            },
            command: 'connect',
        });
        return new Promise(res => {
            const tlsSocket = connect(
                {
                    ...this.options.additionalOptions,
                    socket: info.socket,
                    host: this.options.host,
                    port: this.options.port,
                },
                () => {
                    this.duplex.setWritable(tlsSocket);
                    this.duplex.setReadable(tlsSocket);
                    // this.duplex.uncork();
                    res();
                },
            );
        });
    }
}
