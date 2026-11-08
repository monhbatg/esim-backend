export interface UserDashboardDto  extends Request {
    totalPurchases: number;
    totalAmountSpent: number;
    lastPurchaseDate: string | null;
    lastPurchasePackageName: string | null;
    lastPurchaseCountry: string | null;
    lastPurchasePrice: number | null;
}