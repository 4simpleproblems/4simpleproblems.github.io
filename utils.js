        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
        import { firebaseConfig } from "../firebase-config.js"; 

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);

        /**
         * Checks if the current user is an admin by fetching their admin document.
         */
        export async function checkAdminStatus(uid) {
            try {
                const adminDocRef = doc(db, 'admins', uid);
                const adminSnap = await getDoc(adminDocRef);
                
                if (adminSnap.exists()) {
                    const data = adminSnap.data();
                    return data.role === 'admin' || data.role === 'superadmin';
                }
                return false;
            } catch (e) {
                console.error("Error checking admin status:", e);
                return false;
            }
        }
