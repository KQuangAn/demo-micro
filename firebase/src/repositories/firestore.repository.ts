import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  QueryConstraint,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore';
import { firebaseConfig } from '@/config/firebase.config';
import { FirestoreError, handleFirebaseError, ValidationError } from '@/utils/errors';
import { logger } from '@/utils/logger';
import { QueryOptions, PaginatedResult } from '@/types';

/**
 * Generic Firestore Repository
 * Implements Repository Pattern for Firestore operations
 * Provides type-safe CRUD operations with proper error handling
 */
export class FirestoreRepository<T extends { id: string }> {
  protected firestore = firebaseConfig.getFirestore();
  protected collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  /**
   * Get document by ID
   */
  async findById(id: string): Promise<T | null> {
    try {
      logger.debug(`Finding document by ID: ${id}`, { collection: this.collectionName });

      const docRef = doc(this.firestore, this.collectionName, id);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        logger.debug(`Document not found: ${id}`, { collection: this.collectionName });
        return null;
      }

      return this.mapDocument(docSnap.data(), docSnap.id);
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error(`Find by ID failed: ${id}`, firebaseError as Error, {
        collection: this.collectionName,
      });
      throw new FirestoreError(
        `Failed to find document: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Get all documents
   */
  async findAll(options?: QueryOptions): Promise<T[]> {
    try {
      logger.debug('Finding all documents', { collection: this.collectionName });

      const constraints = this.buildQueryConstraints(options);
      const q = query(collection(this.firestore, this.collectionName), ...constraints);
      const querySnapshot = await getDocs(q);

      return querySnapshot.docs.map((docSnap) => this.mapDocument(docSnap.data(), docSnap.id));
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error('Find all failed', firebaseError as Error, { collection: this.collectionName });
      throw new FirestoreError(
        `Failed to find documents: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Get paginated documents
   */
  async findPaginated(options?: QueryOptions): Promise<PaginatedResult<T>> {
    try {
      logger.debug('Finding paginated documents', { collection: this.collectionName });

      const constraints = this.buildQueryConstraints(options);
      const q = query(collection(this.firestore, this.collectionName), ...constraints);
      const querySnapshot = await getDocs(q);

      const data = querySnapshot.docs.map((docSnap) =>
        this.mapDocument(docSnap.data(), docSnap.id)
      );

      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      const hasMore = querySnapshot.docs.length === (options?.limit || 10);

      return {
        data,
        hasMore,
        lastDoc: lastDoc || undefined,
      };
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error('Find paginated failed', firebaseError as Error, {
        collection: this.collectionName,
      });
      throw new FirestoreError(
        `Failed to find paginated documents: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Create document
   */
  async create(data: Omit<T, 'id'>, id?: string): Promise<T> {
    try {
      if (!id && !(data as any).id) {
        throw new ValidationError('Document ID is required');
      }

      const docId = id || (data as any).id;
      logger.debug(`Creating document: ${docId}`, { collection: this.collectionName });

      const docRef = doc(this.firestore, this.collectionName, docId);
      const documentData = this.prepareDataForFirestore(data);

      await setDoc(docRef, documentData);

      logger.info(`Document created: ${docId}`, { collection: this.collectionName });

      return this.mapDocument({ ...documentData, id: docId }, docId);
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      const firebaseError = handleFirebaseError(error);
      logger.error(`Create failed: ${id}`, firebaseError as Error, {
        collection: this.collectionName,
      });
      throw new FirestoreError(
        `Failed to create document: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Update document
   */
  async update(id: string, data: Partial<T>): Promise<void> {
    try {
      logger.debug(`Updating document: ${id}`, { collection: this.collectionName });

      const docRef = doc(this.firestore, this.collectionName, id);
      const updateData = this.prepareDataForFirestore(data);

      await updateDoc(docRef, updateData);

      logger.info(`Document updated: ${id}`, { collection: this.collectionName });
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error(`Update failed: ${id}`, firebaseError as Error, {
        collection: this.collectionName,
      });
      throw new FirestoreError(
        `Failed to update document: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Delete document
   */
  async delete(id: string): Promise<void> {
    try {
      logger.debug(`Deleting document: ${id}`, { collection: this.collectionName });

      const docRef = doc(this.firestore, this.collectionName, id);
      await deleteDoc(docRef);

      logger.info(`Document deleted: ${id}`, { collection: this.collectionName });
    } catch (error) {
      const firebaseError = handleFirebaseError(error);
      logger.error(`Delete failed: ${id}`, firebaseError as Error, {
        collection: this.collectionName,
      });
      throw new FirestoreError(
        `Failed to delete document: ${firebaseError.message}`,
        firebaseError.code,
        firebaseError
      );
    }
  }

  /**
   * Build query constraints from options
   */
  protected buildQueryConstraints(options?: QueryOptions): QueryConstraint[] {
    const constraints: QueryConstraint[] = [];

    if (options?.where) {
      for (const condition of options.where) {
        constraints.push(
          where(condition.field, condition.operator, condition.value) as QueryConstraint
        );
      }
    }

    if (options?.orderBy) {
      constraints.push(
        orderBy(
          options.orderBy,
          options.orderDirection === 'desc' ? 'desc' : 'asc'
        ) as QueryConstraint
      );
    }

    if (options?.limit) {
      constraints.push(limit(options.limit) as QueryConstraint);
    }

    if (options?.startAfter) {
      constraints.push(startAfter(options.startAfter) as QueryConstraint);
    }

    return constraints;
  }

  /**
   * Prepare data for Firestore (convert Date to Timestamp, etc.)
   */
  protected prepareDataForFirestore(data: any): any {
    const prepared: any = { ...data };

    // Convert Date objects to Firestore Timestamps
    for (const key in prepared) {
      if (prepared[key] instanceof Date) {
        prepared[key] = Timestamp.fromDate(prepared[key]);
      }
    }

    // Remove id from data (it's the document ID)
    delete prepared.id;

    return prepared;
  }

  /**
   * Map Firestore document to entity
   * Override in subclasses for custom mapping
   */
  protected mapDocument(data: DocumentData, id: string): T {
    // Convert Firestore Timestamps to Dates
    const mapped: any = { ...data, id };

    for (const key in mapped) {
      if (mapped[key] instanceof Timestamp) {
        mapped[key] = mapped[key].toDate();
      }
    }

    return mapped as T;
  }
}

