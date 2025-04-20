import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InventoryModule } from '../inventory/inventory.module';
import { QueueService } from './queue.service';

@Module({
    imports: [ConfigModule, InventoryModule],
    providers: [QueueService],
    exports: [QueueService],
})
export class QueueModule {
    //globally
    // static forRoot() {
    //     return {
    //         module: FeatureModule,
    //         providers: [/* providers specific to the feature */],
    //     };
    // }
    // per module
    static forFeature(config: { someOption: string }): DynamicModule {
        return {
            module: QueueModule,
            providers: [
                {
                    provide: 'QUEUE_CLIENT',
                    useValue: config.someOption,
                },
                QueueService
            ],
            exports: [QueueService],
        };
    }
}
