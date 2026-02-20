import { Module } from '@nestjs/common';
import { EndpointsService } from './endpoints.service';
import { EndpointsController } from './endpoints.controller';
import { DatabaseModule } from '@/database/database.module';
import { EventsModule } from '@/events/events.module';

@Module({
  imports: [DatabaseModule, EventsModule],
  controllers: [EndpointsController],
  providers: [EndpointsService],
})
export class EndpointsModule {}
