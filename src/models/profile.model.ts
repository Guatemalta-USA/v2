import type { LocalizedString } from "./helper.model";

export interface Profile {
    name: string;
    photoURL: string;
    position: LocalizedString;
    about: LocalizedString;
    email: string;
    country: string;
}