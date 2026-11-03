export class ChildSponsorship {
    public name: string;
    public cohort: string;
    public dateOfBirth: Date;
    public village: string;
    public bio: string;
    public photoURL: string;
    public sponsor: string[] | null = null;

    constructor(
        name: string,
        cohort: string,
        dateOfBirth: Date,
        village: string,
        bio: string,
        photoURL: string,
    ) {
        this.name = name;
        this.cohort = cohort;
        this.dateOfBirth = dateOfBirth;
        this.village = village;
        this.bio = bio;
        this.photoURL = photoURL;
    }
}

export class Donor {
    public refCode: string;
    public donorName: string;
    public donorEmail: string;
    public selectedChildName: string | null = null;
    public year: number;

    constructor(
        refCode: string,
        donorName: string,
        donorEmail: string,
        year: number
    ) {
        this.refCode = refCode;
        this.donorName = donorName;
        this.donorEmail = donorEmail;
        this.year = year;
    }
}

export interface refStatus {
    isValid: boolean;
    donorName: string;
    hasClaimed: boolean;
    childName?: string;
    error?: string;
}