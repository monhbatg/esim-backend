import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from '../entities/user.entity';
import { AuthModule } from '../auth/auth.module';
import { SettingsReferences } from 'src/entities/settings-references.entity';
import { ReferencesHistory } from 'src/entities/reference-history.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    User,
    SettingsReferences,
    ReferencesHistory
  ]), forwardRef(() => AuthModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}