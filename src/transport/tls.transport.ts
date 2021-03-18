import { Transport } from './transport';
import { ConnectionOptions, connect } from 'tls';
import duplexify = require('duplexify');
import { Duplexify } from 'duplexify';

export interface TlsTransportOptions {
    host: string;
    port: number;
    additionalOptions?: ConnectionOptions;
}
export class TlsTransport extends Transport<TlsTransportOptions> {
    // these will be set on the constructor
    public duplex!: Duplexify;

    constructor(options: TlsTransportOptions) {
        super(options);
        this.reset();
    }

    reset() {
        this.duplex = duplexify(undefined, undefined, { objectMode: true });

        // buffer packets until connect()
        // this.duplex.cork();
    }

    connect(): Promise<void> {
        return new Promise(res => {
            const tlsSocket = connect(
                {
                    ...this.options.additionalOptions,
                    host: this.options.host,
                    port: this.options.port,
                },
                () => {
                    this.duplex.setReadable(tlsSocket);
                    this.duplex.setWritable(tlsSocket);
                    // this.duplex.uncork();
                    res();
                },
            );
        });
    }
}
