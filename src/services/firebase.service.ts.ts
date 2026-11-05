import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    QueryDocumentSnapshot,
    serverTimestamp,
    setDoc,
    updateDoc,
    limit,
    where,
    type FirestoreDataConverter,
    type SnapshotOptions,
    writeBatch,
    arrayUnion,
    runTransaction
} from "firebase/firestore";
import { db } from "./firebase";
import { state } from "../modules/state.module";
import { PageContents } from "../models/page.model";
import { Post } from "../models/post.model";
import type { Profile } from "../models/profile.model";
import { Project, type ProjectInfo } from "../models/project.model";
import type { ChildSponsorship, Donor, refStatus } from "../models/sponsorship.model";

// Global Firebase Variables
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

// Pages
export async function addPage(pageId: string, pageData: PageContents): Promise<void> {
    try {
        const docRef = doc(db, "pages", pageId);
        await setDoc(docRef, pageData.toFirestore());
        state.setPage(pageId, pageData);
        console.log(`Page "${pageId}" created successfully.`);
    } catch (error) {
        console.error("Error adding page:", error);
        throw new Error("Failed to create the page.");
    }
}

export interface PageSummary {
    id: string;
    pageName: { en: string; es: string };
}

export async function getAllPageSummaries(): Promise<PageSummary[]> {
    try {
        const querySnapshot = await getDocs(collection(db, "pages"));
        const summaries: PageSummary[] = [];

        querySnapshot.forEach((docSnap) => {
            const rawData = docSnap.data();
            const pageInstance = PageContents.fromFirestore(rawData);

            summaries.push({
                id: docSnap.id,
                pageName: pageInstance.pageName
            });
        });

        return summaries;
    } catch (error) {
        console.error("Error fetching page summaries:", error);
        throw new Error("Could not load page list.");
    }
}

export async function getPageContents(pageName: string): Promise<PageContents | null> {
    const cachedPage = state.getPage(pageName);
    if (cachedPage) {
        return cachedPage as PageContents;
    }

    try {
        const docRef = doc(db, "pages", pageName);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const rawData = docSnap.data();
            const pageInstance = PageContents.fromFirestore(rawData);
            state.setPage(pageName, pageInstance);
            return pageInstance;
        } else {
            console.warn(`Page "${pageName}" not found!`);
            return null;
        }
    } catch (error) {
        console.error("Error fetching page:", error);
        throw new Error("Could not load page contents.");
    }
}

export async function updatePageContents(pageName: string, pageData: PageContents): Promise<void> {
    try {
        const docRef = doc(db, "pages", pageName);
        
        pageData.lastUpdated = serverTimestamp() as any;

        await setDoc(docRef, pageData.toFirestore(), { merge: true });
        
        state.setPage(pageName, pageData);
    } catch (error) {
        console.error("Error updating page contents:", error);
        throw new Error("Could not update page contents.");
    }
}

export async function deletePageContents(pageName: string): Promise<void> {
    try {
        const docRef = doc(db, "pages", pageName);
        await deleteDoc(docRef);
        // Clear or remove the page entry from local state cache if applicable
        if (state.setPage) {
            state.setPage(pageName, null);
        }
        console.log(`Page "${pageName}" deleted successfully.`);
    } catch (error) {
        console.error("Error deleting page:", error);
        throw new Error("Could not delete the page. Please check permissions.");
    }
}

// Profiles
export async function addProfile(data: Profile) {
    try {
        const docRef = doc(db, "profiles", data.name);
        await setDoc(docRef, data);
        state.profiles = null;
    } catch (error) {
        console.error("Error adding profile: ", error);
        throw new Error("Failed to add profile");
    }
}

export async function getAllProfiles(): Promise<Profile[]> {
    if (state.profiles) {
        return state.profiles as Profile[];
    }

    try {
        const profilesQuery = query(collection(db, "profiles"), orderBy("name", "asc"));
        const querySnapshot = await getDocs(profilesQuery);

        const profiles: Profile[] = querySnapshot.docs.map(doc => ({
            ...doc.data()
        } as Profile));

        state.profiles = profiles;
        return profiles;
    } catch (error) {
        console.error("Error fetching all profiles: ", error);
        throw new Error("Failed to fetch profiles");
    }
}

export async function getProfilesByCountry(countryName: string): Promise<Profile[]> {
    const profiles = await getAllProfiles();
    return profiles.filter(p => p.country === countryName);
}

export async function updateProfile(name: string, updates: Partial<Profile>) {
    try {
        const docRef = doc(db, "profiles", name);
        await updateDoc(docRef, updates);
        state.profiles = null;
    } catch (error) {
        console.error("Error updating profile: ", error);
        throw new Error("Failed to update profile");
    }
}

export async function deleteProfile(name: string) {
    try {
        const docRef = doc(db, "profiles", name);
        await deleteDoc(docRef);
        state.profiles = null;
    } catch (error) {
        console.error("Error deleting profile: ", error);
        throw new Error("Failed to delete profile");
    }
}

// Child Sponsorship
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

        return querySnapshot.docs.map(doc => ({
            ...doc.data()
        } as ChildSponsorship));
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

// Sponsorship Donors
export async function getAllDonors() {
    try {
        const donorQuery = query(collection(db, "referrals"), orderBy("year", "desc"));
        const querySnapshot = await getDocs(donorQuery);

        return querySnapshot.docs.map(doc => ({
            ...doc.data(),
            refCode: doc.id
        } as Donor));
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
        };

        if (!docSnap.exists()) {
            result["isValid"] = false;
            result["error"] = "Invalid referral code. Please check the email or contact us for assistance";
            return result;
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
        return { isValid: false, donorName: "", hasClaimed: false, error: "Error. Please try reloading the page" };
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


// Posts
export async function getAllPosts(): Promise<Post[]> {
    if (state.posts) {
        return state.posts as Post[];
    }

    const q = query(collection(db, "posts"), orderBy("publishDate", "desc"));
    const querySnapshot = await getDocs(q);
    const posts = querySnapshot.docs.map(doc => Post.fromFirestore(doc.id, doc.data()));
    
    state.posts = posts;
    return posts;
}

export async function getPostsWithLinkedProjectId(projectId: string): Promise<Post[]> {
    const posts = await getAllPosts();
    return posts.filter(post => post.linkedProjectId === projectId);
}

export async function savePost(post: Post): Promise<string> {
    let postId = post.id;
    if (postId) {
        const docRef = doc(db, POSTS_PATH, postId);
        await updateDoc(docRef, post.toFirestore());
    } else {
        const customId = slugify(post.postTitle.en);
        const docRef = doc(db, POSTS_PATH, customId);
        await setDoc(docRef, post.toFirestore());
        postId = customId;
    }
    state.posts = null;
    return postId;
}

export async function getPostById(id: string): Promise<Post | null> {
    const posts = await getAllPosts();
    const found = posts.find(p => p.id === id);
    if (found) return found;

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
        state.posts = null;
        console.log(`Firestore: Post ${postId} successfully deleted.`);
    } catch (error) {
        console.error("Error deleting post from Firestore:", error);
        throw new Error("Could not delete post. Please check permissions.");
    }
}

// Projects
export async function getAllProjects(): Promise<Project[]> {
    if (state.projects) {
        return state.projects as Project[];
    }

    const q = query(collection(db, "projects"));
    const querySnapshot = await getDocs(q);
    const projects = querySnapshot.docs.map(doc => Project.fromFirestore(doc.id, doc.data()));
    
    state.projects = projects;
    return projects;
}

export async function getProjectsByStatus(isCurrent: boolean): Promise<Project[]> {
    const projects = await getAllProjects();
    
    return projects
        .filter(p => p.isCurrent === isCurrent && p.published === true)
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
}

export async function getUnpublishedProjects(): Promise<Project[]> {
    const projects = await getAllProjects();
    return projects.filter(p => p.published === false);
}

export async function getProjectById(id: string): Promise<Project | null> {
    const projects = await getAllProjects();
    const found = projects.find(p => p.id === id);
    if (found) return found;

    const docRef = doc(db, 'projects', id).withConverter(projectConverter);
    const docSnap = await getDoc(docRef);

    return docSnap.exists() ? docSnap.data() : null;
}

export async function saveProject(project: Project): Promise<string> {
  try {
    let savedId = project.id;
    if (savedId) {
      const docRef = doc(db, 'projects', savedId);
      await setDoc(docRef, project.toFirestore());
    } else {
      const projectsRef = collection(db, 'projects');
      const q = query(projectsRef, orderBy('orderIndex', 'desc'), limit(1));
      const snapshot = await getDocs(q);

      let nextOrderIndex = 1;
      if (!snapshot.empty) {
        const highestProject = snapshot.docs[0].data();
        nextOrderIndex = (highestProject.orderIndex || 0) + 1;
      }

      project.orderIndex = nextOrderIndex;

      const titleString = project.projectTitle.en || project.projectTitle.es || 'untitled-project';
      const customId = slugify(titleString);
      
      const docRef = doc(db, 'projects', customId);
      await setDoc(docRef, project.toFirestore());
      savedId = customId;
    }

    state.projects = null;
    return savedId!;
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
        state.projects = null;
    } catch (error) {
        console.error("Error committing batch order update:", error);
        throw new Error("Could not update project order.");
    }
}

export async function deleteProject(id: string): Promise<void> {
    const docRef = doc(db, 'projects', id);
    await deleteDoc(docRef);
    state.projects = null;
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
        state.donateList = null;
        return docRef.id;
    } catch (error) {
        console.error("Error setting project link: ", error);
        throw new Error("Failed to set project in Donate Button List");
    }
}

export async function getDonateButtonList() {
    if (state.donateList) {
        return state.donateList as ProjectInfo[];
    }

    try {
        const q = query(collection(db, "donateButtonList"), orderBy("orderIndex", "asc"));
        const querySnapshot = await getDocs(q);

        const donateList: ProjectInfo[] = querySnapshot.docs.map(doc => ({
            ...doc.data()
        } as ProjectInfo));

        state.donateList = donateList;
        return donateList;
    } catch (error: any) {
        console.error("Error fetching Donate Button List", error);
        throw new Error("Failed to fetch Donate Button List");
    }
}

export async function getProjectLinkByFormId(formId: string): Promise<ProjectInfo | null> {
    const donateList = await getDonateButtonList();
    return donateList.find(item => item.formId === formId) || null;
}

export async function deleteProjectFromDonateList(docId: string) {
    try {
        const docRef = doc(db, "donateButtonList", docId);
        await deleteDoc(docRef);
        state.donateList = null;
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
        state.donateList = null;
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