import { createContext, useContext, useState, ReactNode } from "react";

type User = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "company_user";
  assignedCompanyIds: string[]; // Companies this user has access to
};

type AuthContextType = {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  canAccessCompany: (companyId: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock users - replace with real API
const mockUsers: User[] = [
  {
    id: "USR-001",
    name: "Admin User",
    email: "admin@example.com",
    role: "admin",
    assignedCompanyIds: [], // Admin can see all companies
  },
  {
    id: "USR-002",
    name: "Tech Solutions HR",
    email: "hr@techsolutions.com",
    role: "company_user",
    assignedCompanyIds: ["COMP-12345678"], // Can only see Tech Solutions
  },
  {
    id: "USR-003",
    name: "Innovation Labs Manager",
    email: "manager@innovationlabs.com",
    role: "company_user",
    assignedCompanyIds: ["COMP-87654321"], // Can only see Innovation Labs
  },
];

export function AuthProvider({ children }: { children: ReactNode }) {
  // Default to admin user for demo - replace with null for production
  const [user, setUser] = useState<User | null>(mockUsers[0]);

  const login = async (email: string, _password: string) => {
    // Mock login - replace with real API call
    const foundUser = mockUsers.find((u) => u.email === email);
    if (foundUser) {
      setUser(foundUser);
    } else {
      throw new Error("Invalid credentials");
    }
  };

  const logout = () => {
    setUser(null);
  };

  const canAccessCompany = (companyId: string): boolean => {
    if (!user) return false;

    // Admin can access all companies
    if (user.role === "admin") return true;

    // Company users can only access assigned companies
    return user.assignedCompanyIds.includes(companyId);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
        canAccessCompany,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
