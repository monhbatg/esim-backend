import { ReferencesModule } from "./reference-module.enum";
import { ReferencesType } from "./reference-type.enum";

export interface ReferenceReq extends Request {
    module: ReferencesModule,
    key: string,
    type: ReferencesType,
    value: string,
    description: string
}

export interface ReferenceReqList extends Request{
    updatedRef: UpdateRefs[]
}

export interface UpdateRefs extends Request{
    id: string,
    value: string;
}