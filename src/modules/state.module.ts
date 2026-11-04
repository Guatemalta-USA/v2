type StateListener = (state: AppState) => void;

class AppState {
    private _currentUser: any = null;
    private _currentRole: string | null = null;
    private _currentPage: string = "";
    private _parentPage: string = "";
    private _pagesCache: Map<string, any> = new Map();
    private _postsCache: any[] | null = null;
    private _projectsCache: any[] | null = null;
    private _donateListCache: any[] | null = null;
    private _profilesCache: any[] | null = null;

    private listeners: StateListener[] = [];

    public subscribe(listener: StateListener): () => void {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        for (const listener of this.listeners) {
            listener(this);
        }
    }

    get currentUser(): any { return this._currentUser; }
    setCurrentUser(newUser: any) {
        if (this._currentUser !== newUser) {
            this._currentUser = newUser;
            this.notify();
        }
    }

    get currentRole(): string | null { return this._currentRole; }
    setCurrentRole(newRole: string | null) {
        if (this._currentRole !== newRole) {
            this._currentRole = newRole;
            this.notify();
        }
    }

    get currentPage(): string { return this._currentPage; }
    get parentPage(): string { return this._parentPage; }

    setPageContext(params: { page?: string; parent?: string }) {
        const newPage = params.page ?? "";
        const newParent = params.parent ?? "";

        if (newPage) {
            const formatted = newPage
                .split("-")
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(" ");
            document.title = `${formatted} | Guatemalta USA`;
        } else {
            document.title = "Guatemalta USA | Sustainable Housing & Education Nonprofit";
        }

        if (this._currentPage !== newPage || this._parentPage !== newParent) {
            this._currentPage = newPage;
            this._parentPage = newParent;
            this.notify();
        }
    }

    getPage(pageName: string) { return this._pagesCache.get(pageName); }
    setPage(pageName: string, data: any) { this._pagesCache.set(pageName, data); }

    get posts() { return this._postsCache; }
    set posts(data: any[] | null) { this._postsCache = data; }

    get projects() { return this._projectsCache; }
    set projects(data: any[] | null) { this._projectsCache = data; }

    get donateList() { return this._donateListCache; }
    set donateList(data: any[] | null) { this._donateListCache = data; }

    get profiles() { return this._profilesCache; }
    set profiles(data: any[] | null) { this._profilesCache = data; }

    clearCache() {
        this._pagesCache.clear();
        this._postsCache = null;
        this._projectsCache = null;
        this._donateListCache = null;
        this._profilesCache = null;
    }
}

export const state = new AppState();