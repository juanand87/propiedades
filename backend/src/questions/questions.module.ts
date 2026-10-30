import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailModule } from '../email/email.module';
import { MarketplaceModule } from '../marketplace/marketplace.module';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { Vendor } from '../vendors/vendor.entity';
import { ProductQuestion } from './product-question.entity';
import { ProductQuestionMessage } from './product-question-message.entity';
import { QuestionsController } from './questions.controller';
import { QuestionsService } from './questions.service';
import { VendorQuestionPenalty } from './vendor-penalty.entity';
import { MercadoLibreModule } from '../mercadolibre/mercadolibre.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductQuestion, ProductQuestionMessage, VendorQuestionPenalty, Product, Vendor, User]),
    EmailModule,
    MarketplaceModule,
    forwardRef(() => MercadoLibreModule),
  ],
  controllers: [QuestionsController],
  providers: [QuestionsService],
})
export class QuestionsModule {}
