import { Transport } from './transport';
import { TLSSocket } from 'tls';
import { Socket } from 'net';

export interface TlsTransportOptions {
    host: string;
    port: number;
    enableTrace?: boolean;
}
export class TlsTransport extends Transport<TlsTransportOptions> {
    public duplex: TLSSocket;
    private readonly underlyingSocket: Socket;

    constructor(options: TlsTransportOptions) {
        super(options);
        this.underlyingSocket = new Socket();
        this.underlyingSocket.setNoDelay(true);
        this.duplex = new TLSSocket(this.underlyingSocket);
        this.duplex.setNoDelay(true);
        if (this.options.enableTrace) {
            this.duplex.enableTrace();
        }

        // buffer packets until connect()
        this.duplex.cork();
    }

    connect(): Promise<void> {
        this.underlyingSocket.connect(this.options.port, this.options.host);
        return new Promise(resolve =>
            this.duplex.connect(this.options.port, this.options.host, () => {
                // flush
                this.duplex.uncork();
                resolve();
            }),
        );
    }
}
