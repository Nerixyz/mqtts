export interface MqttsReconnectStrategy {
    /**
     * Whether reconnect should happen or not
     */
    should(reason?: any): boolean;
    /**
     * Reconnect when wait resolves
     */
    wait(): Promise<any>;

    /**
     * Reset reconnect attempts
     */
    reset(): any;
}
