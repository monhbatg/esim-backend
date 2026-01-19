
import { ReferencesModule } from "../users/dto/reference-module.enum";
import { ReferencesType } from "../users/dto/reference-type.enum";
import { 
    Column, 
    CreateDateColumn, 
    Entity, 
    PrimaryGeneratedColumn,
    UpdateDateColumn 
} from "typeorm";

@Entity('settings_references')
export class ConfigVariables {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    
    @Column({
        type: 'enum',
        enum: ReferencesModule,
        default: ReferencesModule.OTHER,
    })
    module: ReferencesModule;

    @Column({ unique: true})
    key: string;

    @Column({
        type: 'enum',
        enum: ReferencesType,
        default: ReferencesType.TEXT,
    })
    type: ReferencesType;

    @Column()
    value: string;

    @Column()
    description: string;

    @Column()
    userId: string;

    @CreateDateColumn()
    createdAt: Date;
    
    @UpdateDateColumn()
    updatedAt: Date;
}