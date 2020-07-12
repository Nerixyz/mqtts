import { Transport } from './transport';
import { Socket } from 'net';

export interface TcpTransportOptions {
    host: string;
    port: number;
}

export class TcpTransport extends Transport<TcpTransportOptions> {
    // these will be set on the constructor
    public duplex!: Socket;

    constructor(options: TcpTransportOptions) {
        super(options);
        this.reset();
    }

    reset() {
        this.duplex = new Socket();
        this.duplex.setNoDelay(true);

        // buffer packets
        this.duplex.cork();
    }

    connect(): Promise<void> {
        return new Promise(resolve =>
            this.duplex.connect(this.options.port, this.options.host, () => {
                // flush
                this.duplex.uncork();
                resolve();
            }),
        );
    }
}
