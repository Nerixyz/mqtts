import { Transport } from './transport';
import { ConnectionOptions, connect } from 'tls';
import { Duplex, PassThrough } from 'stream';
import duplexify = require('duplexify');

export interface TlsTransportOptions {
    host: string;
    port: number;
    additionalOptions?: ConnectionOptions;
}
export class TlsTransport extends Transport<TlsTransportOptions> {
    // these will be set on the constructor
    public duplex!: Duplex;
    private readonly writable = new PassThrough();
    private readonly readable = new PassThrough();

    constructor(options: TlsTransportOptions) {
        super(options);
        this.reset();
    }

    reset() {
        this.duplex = duplexify(this.writable, this.readable, { objectMode: true });

        // buffer packets until connect()
        this.duplex.cork();
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
                    tlsSocket.pipe(this.readable);
                    this.writable.pipe(tlsSocket);
                    this.duplex.uncork();
                    res();
                },
            );
        });
    }
}
