import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1771259599211 implements MigrationInterface {
    name = 'Migration1771259599211'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "destination_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "endpointId" uuid NOT NULL, "httpMethod" character varying NOT NULL DEFAULT 'POST', "headers" json, "url" character varying NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_54f3f8af773788fd8c7642bf75f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "endpoint_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying NOT NULL, "name" character varying NOT NULL, "description" character varying, "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_1719c3c0adb62fa4e70e26ab84c" UNIQUE ("slug"), CONSTRAINT "PK_0b661f4960b6499c75dbeca140c" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."delivery_attempt_entity_status_enum" AS ENUM('pending', 'success', 'failed')`);
        await queryRunner.query(`CREATE TABLE "delivery_attempt_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "status" "public"."delivery_attempt_entity_status_enum" NOT NULL DEFAULT 'pending', "attemptNumber" integer NOT NULL DEFAULT '1', "requestHeaders" json, "requestBody" json, "responseStatusCode" integer, "responseBody" text, "errorMessage" character varying, "attemptedAt" TIMESTAMP NOT NULL DEFAULT now(), "nextRetryAt" TIMESTAMP, "eventId" uuid, "destinationId" uuid, CONSTRAINT "PK_c51e80d779c8ecaec2eb282e585" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "event_entity" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "endpointId" uuid NOT NULL, "method" character varying NOT NULL, "headers" json NOT NULL, "body" json, "queryParams" json, "sourceIp" character varying, "receivedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c5675e66b601bd4d0882054a430" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "destination_entity" ADD CONSTRAINT "FK_6efb462cc4c801fedb59b11ee13" FOREIGN KEY ("endpointId") REFERENCES "endpoint_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_attempt_entity" ADD CONSTRAINT "FK_b5e14a97a2297955992594a6f02" FOREIGN KEY ("eventId") REFERENCES "event_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "delivery_attempt_entity" ADD CONSTRAINT "FK_1b57b25bac4b72c0d34449b2a75" FOREIGN KEY ("destinationId") REFERENCES "destination_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "event_entity" ADD CONSTRAINT "FK_b878efd2e30f4094cfb8fe19086" FOREIGN KEY ("endpointId") REFERENCES "endpoint_entity"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "event_entity" DROP CONSTRAINT "FK_b878efd2e30f4094cfb8fe19086"`);
        await queryRunner.query(`ALTER TABLE "delivery_attempt_entity" DROP CONSTRAINT "FK_1b57b25bac4b72c0d34449b2a75"`);
        await queryRunner.query(`ALTER TABLE "delivery_attempt_entity" DROP CONSTRAINT "FK_b5e14a97a2297955992594a6f02"`);
        await queryRunner.query(`ALTER TABLE "destination_entity" DROP CONSTRAINT "FK_6efb462cc4c801fedb59b11ee13"`);
        await queryRunner.query(`DROP TABLE "event_entity"`);
        await queryRunner.query(`DROP TABLE "delivery_attempt_entity"`);
        await queryRunner.query(`DROP TYPE "public"."delivery_attempt_entity_status_enum"`);
        await queryRunner.query(`DROP TABLE "endpoint_entity"`);
        await queryRunner.query(`DROP TABLE "destination_entity"`);
    }

}
