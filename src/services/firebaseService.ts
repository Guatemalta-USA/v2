import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    QueryDocumentSnapshot,
    runTransaction,
    serverTimestamp,
    setDoc,
    updateDoc,
    limit,
    where,
    type FirestoreDataConverter,
    type SnapshotOptions,
    writeBatch,
    arrayUnion
} from "firebase/firestore";
import { db } from "./firebase";
import type { PageContents } from "../models/page.model";
import { Post } from "../models/post.model";
import type { Profile } from "../models/profile.model";
import { Project, type ProjectInfo } from "../models/project.model";
import type { ChildSponsorship, Donor, refStatus } from "../models/sponsorship.model";

//Global Firebase Variables
declare const __app_id: string;
const POSTS_PATH = 'posts';

const projectConverter: FirestoreDataConverter<Project> = {
    toFirestore(project: Project) {
        return project.toFirestore();
    },
    fromFirestore(snapshot: QueryDocumentSnapshot, options: SnapshotOptions): Project {
        const data = snapshot.data(options);
        return Project.fromFirestore(snapshot.id, data);
    }
};

const projectsCol = collection(db, 'projects').withConverter(projectConverter);

function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

export async function addPage(pageData: PageContents): Promise<void> {
    try {
        const docRef = doc(db, "pages", pageData.pageName);
        await setDoc(docRef, pageData);
        console.log(`Page "${pageData.pageName}" created successfully.`);
    } catch (error) {
        console.error("Error adding page:", error);
        throw new Error("Failed to create the page.");
    }
}

// PAGES
export async function getPageContents(pageName: string): Promise<PageContents | null> {
    try {
        const docRef = doc(db, "pages", pageName);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data() as PageContents;
        } else {
            console.warn(`Page "${pageName}" not found!`);
            return null;
        }
    } catch (error) {
        console.error("Error fetching page:", error);
        throw new Error("Could not load page contents.");
    }
}

export async function updatePageContents(pageName: string, updates: Partial<PageContents>): Promise<void> {
    const docRef = doc(db, "pages", pageName);
    const payload: Record<string, any> = {
        ...updates,
        pageName: pageName,
        lastUpdated: serverTimestamp()
    };

    if (updates.content) {
        delete payload.content;
        payload['content.en'] = updates.content.en || [];
        payload['content.es'] = updates.content.es || [];
    }

    await setDoc(docRef, payload, { merge: true });
}

// PROFILES
export async function addProfile(data: Profile) {
    try {
        const docRef = doc(db, "profiles", data.name);
        await setDoc(docRef, data);
    } catch (error) {
        console.error("Error adding profile: ", error);
        throw new Error("Failed to add profile");
    }
}

export async function getAllProfiles(): Promise<Profile[]> {
    try {
        const profilesQuery = query(collection(db, "profiles"), orderBy("name", "asc"));
        const querySnapshot = await getDocs(profilesQuery);

        const profiles: Profile[] = querySnapshot.docs.map(doc => ({
            ...doc.data()
        } as Profile));

        return profiles;
    } catch (error) {
        console.error("Error fetching all profiles: ", error);
        throw new Error("Failed to fetch profiles");
    }
}

export async function getProfilesByCountry(countryName: string): Promise<Profile[]> {
    try {
        const profilesQuery = query(
            collection(db, "profiles"),
            where("country", "==", countryName),
            orderBy("name", "asc")
        );

        const querySnapshot = await getDocs(profilesQuery);

        const profiles: Profile[] = querySnapshot.docs.map(doc => ({
            ...doc.data()
        } as Profile));

        return profiles;
    } catch (error) {
        console.error(`Error fetching profiles for ${countryName}: `, error);
        throw new Error("Failed to fetch profiles by country");
    }
}

export async function updateProfile(name: string, updates: Partial<Profile>) {
    try {
        const docRef = doc(db, "profiles", name);
        await updateDoc(docRef, updates);
    } catch (error) {
        console.error("Error updating profile: ", error);
        throw new Error("Failed to update profile");
    }
}

export async function deleteProfile(name: string) {
    try {
        const docRef = doc(db, "profiles", name);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting profile: ", error);
        throw new Error("Failed to delete profile");
    }
}

//ChildSponsorship
export async function getAllCohorts(): Promise<string[]> {
  try {
    const querySnapshot = await getDocs(collection(db, "childSponsorships"));
    const cohortsSet = new Set<string>();

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.cohort) {
        cohortsSet.add(data.cohort);
      }
    });

    return Array.from(cohortsSet).sort();
  } catch (error) {
    console.error("Error fetching cohorts:", error);
    throw error;
  }
}

export async function getAllChildSponsorshipsByCohort(cohort: string): Promise<ChildSponsorship[]> {
    try {
        const SponsorshipQuery = query(
            collection(db, "childSponsorships"),
            where("cohort", "==", cohort),
            orderBy("name", "asc")
        );
        const querySnapshot = await getDocs(SponsorshipQuery);

        const sponsorships: ChildSponsorship[] = querySnapshot.docs.map(doc => ({
            ...doc.data()
        } as ChildSponsorship));

        return sponsorships;
    } catch (error) {
        console.error(`Error fetching child sponsorships for ${cohort}: `, error);
        throw new Error(`Failed to fetch sponsorships for ${cohort}`);
    }
}

export async function addChildSponsorship(data: ChildSponsorship) {
    try {
        const docRef = doc(db, "childSponsorships", data.name);
        await setDoc(docRef, data);
    } catch (error) {
        console.error("Error adding Sponsorship: ", error);
        throw new Error("Failed to add child. Please try reloading the page");
    }
}

export async function updateChildSponsorship(name: string, updates: Partial<ChildSponsorship>) {
    try {
        const docRef = doc(db, "childSponsorships", name);
        await updateDoc(docRef, updates);
    } catch (error) {
        console.error("Error updating sponsorship: ", error);
        throw new Error("Failed to update sponsorship. Please try reloading the page.");
    }
}

export async function deleteChildSponsorship(name: string) {
    try {
        const docRef = doc(db, "childSponsorships", name);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting sponsorship: ", error);
        throw new Error("Failed to delete sponsorship");
    }
}

//Sponsorship Donors
export async function getAllDonors() {
    try {
        const donorQuery = query(collection(db, "referrals"), orderBy("year", "desc"));
        const querySnapshot = await getDocs(donorQuery);

        const donors: Donor[] = querySnapshot.docs.map(doc => ({
            ...doc.data(),
            refCode: doc.id
        } as Donor));
        return donors;
    } catch (error) {
        console.error("Error fetching all profiles: ", error);
        throw new Error("Failed to fetch profiles");
    }
}

export async function validateReferralCode(refCode: string): Promise<refStatus> {
    const cleanCode = refCode.trim().toUpperCase();
    try {
        const docRef = doc(db, "referrals", cleanCode);
        const docSnap = await getDoc(docRef);

        const result: refStatus = {
            isValid: true,
            donorName: "",
            hasClaimed: false
        }

        if (!docSnap.exists()) {
            result["isValid"] = false;
            result["error"] = "Invalid referral code. Please check the email or contact us for assistance";
        }

        const data = docSnap.data();
        if (data) {
            result["donorName"] = data.donorName;
            if (data.selectedChildName) {
                result["hasClaimed"] = true;
                result["childName"] = data.selectedChildName;
            }
            return result;
        } else {
            result["isValid"] = false;
            result["error"] = "Invalid referral code. Please check the email or contact us for assistance";
            return result;
        }
    } catch (error) {
        console.error("Error validating refCode: ", error);
        return { isValid: false, donorName: "", hasClaimed: false, error: "Error. Please try reloading the page" }
    }
}

export async function updateDonor(refCode: string, childName: string): Promise<boolean> {
    const cleanRefCode = refCode.trim().toUpperCase();
    const referralRef = doc(db, "referrals", cleanRefCode);
    const childRef = doc(db, "childSponsorships", childName);

    try {
        await runTransaction(db, async (transaction) => {
            const referralDoc = await transaction.get(referralRef);
            const childDoc = await transaction.get(childRef);

            if (!referralDoc.exists()) {
                throw new Error("This reference code does not exist.");
            }

            if (!childDoc.exists()) {
                throw new Error("The selected child profile could not be found.");
            }

            const referralData = referralDoc.data();
            const childData = childDoc.data();

            if (referralData.selectedChildName) {
                throw new Error("Error. You have already selected a child to sponsor. Please contact us with any questions.");
            }

            const donorName = referralData.donorName || "Sponsored";
            const currentSponsors: string[] = childData.sponsor || [];

            if (currentSponsors.includes(donorName)) {
                throw new Error("Error. You are already listed as a sponsor for this child.");
            }

            transaction.update(referralRef, {
                selectedChildName: childName,
                claimedAt: new Date()
            });

            transaction.update(childRef, {
                sponsor: arrayUnion(donorName)
            });
        });

        return true;
    } catch (error: any) {
        console.error("Sponsorship transaction failed:", error.message);
        throw error;
    }
}


//POSTS
export async function getAllPosts(): Promise<Post[]> {
    const q = query(collection(db, "posts"), orderBy("publishDate", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => Post.fromFirestore(doc.id, doc.data()));
}

export async function getPostsWithLinkedProjectId(projectId: string): Promise<Post[]> {
    const q = query(collection(db, "posts"), where('linkedProjectId', '==', projectId));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => Post.fromFirestore(doc.id, doc.data()));
}

export async function savePost(post: Post): Promise<string> {
    if (post.id) {
        const docRef = doc(db, POSTS_PATH, post.id);
        await updateDoc(docRef, post.toFirestore());
        return post.id;
    }
    const customId = slugify(post.postTitle.en);
    const docRef = doc(db, POSTS_PATH, customId);
    await setDoc(docRef, post.toFirestore());

    return customId;
}

export async function getPostById(id: string): Promise<Post | null> {
    const docRef = doc(db, "posts", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return Post.fromFirestore(docSnap.id, docSnap.data());
    }
    return null;
}

export async function deletePost(postId: string): Promise<void> {
    try {
        const postRef = doc(db, "posts", postId);
        await deleteDoc(postRef);

        console.log(`Firestore: Post ${postId} successfully deleted.`);
    } catch (error) {
        console.error("Error deleting post from Firestore:", error);
        throw new Error("Could not delete post. Please check permissions.");
    }
}

// PROJECTS
export async function getAllProjects(): Promise<Project[]> {
    const q = query(collection(db, "projects"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => Project.fromFirestore(doc.id, doc.data()));
}

export async function getProjectsByStatus(isCurrent: boolean): Promise<Project[]> {
    const sortField = isCurrent ? "orderIndex" : "projectTitle.en";

    const q = query(
        collection(db, 'projects').withConverter(projectConverter),
        where("isCurrent", "==", isCurrent),
        where("published", "==", true),
        orderBy(sortField, "asc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((doc) => doc.data());
}

export async function getUnpublishedProjects(): Promise<Project[]> {
    const q = query(projectsCol, where("published", "==", false));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
}

export async function getProjectById(id: string): Promise<Project | null> {
    const docRef = doc(db, 'projects', id).withConverter(projectConverter);
    const docSnap = await getDoc(docRef);

    return docSnap.exists() ? docSnap.data() : null;
}

export async function saveProject(project: Project): Promise<string> {
  try {
    if (project.id) {
      // Update existing document - maintain existing orderIndex
      const docRef = doc(db, 'projects', project.id);
      await setDoc(docRef, project.toFirestore());
      return project.id;
    } else {
      // 1. Find highest existing orderIndex
      const projectsRef = collection(db, 'projects');
      const q = query(projectsRef, orderBy('orderIndex', 'desc'), limit(1));
      const snapshot = await getDocs(q);

      let nextOrderIndex = 1;
      if (!snapshot.empty) {
        const highestProject = snapshot.docs[0].data();
        nextOrderIndex = (highestProject.orderIndex || 0) + 1;
      }

      // 2. Assign the next orderIndex
      project.orderIndex = nextOrderIndex;

      // 3. Generate custom slug ID and save
      const titleString = project.projectTitle.en || project.projectTitle.es || 'untitled-project';
      const customId = slugify(titleString);
      
      const docRef = doc(db, 'projects', customId);
      await setDoc(docRef, project.toFirestore());
      return customId;
    }
  } catch (error) {
    console.error("Error saving project: ", error);
    throw error;
  }
}

export async function updateProjectsOrder(orderUpdates: { id: string; newOrderIndex: number }[]): Promise<void> {
    const batch = writeBatch(db);

    orderUpdates.forEach(({ id, newOrderIndex }) => {
        const projectRef = doc(db, 'projects', id);
        batch.update(projectRef, { orderIndex: newOrderIndex });
    });

    try {
        await batch.commit();
    } catch (error) {
        console.error("Error committing batch order update:", error);
        throw new Error("Could not update project order.");
    }
}

export async function deleteProject(id: string): Promise<void> {
    const docRef = doc(db, 'projects', id);
    await deleteDoc(docRef);
}

// Donate Button List
export async function setProjectLink(project: ProjectInfo) {
    try {
        const collectionRef = collection(db, "donateButtonList");
        const docRef = project.id ? doc(collectionRef, project.id) : doc(collectionRef);

        const projectData = {
            ...project,
            id: docRef.id,
        };

        await setDoc(docRef, projectData, { merge: true });
        return docRef.id;
    } catch (error) {
        console.error("Error setting project link: ", error);
        throw new Error("Failed to set project in Donate Button List");
    }
}

export async function getDonateButtonList() {
    try {
        const q = query(collection(db, "donateButtonList"), orderBy("orderIndex", "asc"));
        const querySnapshot = await getDocs(q);

        const donateList: ProjectInfo[] = querySnapshot.docs.map(doc => ({
            ...doc.data()
        } as ProjectInfo));
        return donateList;
    } catch (error: any) {
        console.error("Error fetching Donate Button List", error);
        throw new Error("Failed to fetch Donate Button List");
    }
}

export async function getProjectLinkByFormId(formId: string): Promise<ProjectInfo | null> {
    try {
        const donateListRef = collection(db, "donateButtonList");
        const q = query(donateListRef, where("formId", "==", formId));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            return {
                id: docSnap.id,
                ...docSnap.data()
            } as ProjectInfo;
        }

        console.warn(`No project found with formId: ${formId}`);
        return null;
    } catch (error) {
        console.error("Error fetching project link by formId:", error);
        throw new Error("Failed to retrieve project link");
    }
}

export async function deleteProjectFromDonateList(docId: string) {
    try {
        const docRef = doc(db, "donateButtonList", docId);
        await deleteDoc(docRef);
    } catch (error: any) {
        console.error("Error deleting project from Donate Button List:", error);
        throw new Error("Failed to delete project from Donate Button List");
    }
}

export async function updateDonateListOrder(orderUpdates: { id: string; newOrderIndex: number }[]): Promise<void> {
    const batch = writeBatch(db);

    orderUpdates.forEach(({ id, newOrderIndex }) => {
        const donateRef = doc(db, 'donateButtonList', id);
        batch.update(donateRef, { orderIndex: newOrderIndex });
    });

    try {
        await batch.commit();
    } catch (error) {
        console.error("Error committing batch order update for donate list:", error);
        throw new Error("Could not update donate list order.");
    }
}

export async function getCampaignTotalById(projectId: string): Promise<number> {
    const campaignTotalRef = collection(db, "campaignTotals");
    const q = query(campaignTotalRef, where("name", "==", projectId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const campaignTotal = docSnap.data() as { amount: number; name: string };
        return typeof campaignTotal.amount === 'number' ? campaignTotal.amount : 0;
    }
    
    return 0;
}