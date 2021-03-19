import { Duplex } from 'stream';

export abstract class Transport<T> {
    /**
     * The stream the client will use
     * @type {Duplex}
     */
    public abstract duplex?: Duplex;

    public get active(): boolean {
        return !!this.duplex && !this.duplex.destroyed;
    }

    /**
     * @param options These will be set by the MqttClient
     */
    public constructor(protected options: T) {}

    public abstract connect(): Promise<void>;

    /**
     * Close any open connections
     */
    public abstract reset(): void;
}
