import { Test, TestingModule } from '@nestjs/testing';
import { EventsInspectionController } from './events-inspection.controller';

describe('EventsInspectionController', () => {
  let controller: EventsInspectionController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventsInspectionController],
    }).compile();

    controller = module.get<EventsInspectionController>(EventsInspectionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
