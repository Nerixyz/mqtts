import { Duplex } from 'stream';

export abstract class Transport<T> {
    public abstract duplex: Duplex;

    /**
     * This will be set by the MqttClient
     */
    public constructor(protected options: T) {}

    public abstract connect(): Promise<void>;
}
