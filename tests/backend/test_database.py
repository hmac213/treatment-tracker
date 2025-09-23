"""
Database Tests for schema validation and data integrity
"""
import unittest
import psycopg2
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class TestDatabaseSchema(unittest.TestCase):
    """Test database schema and structure"""
    
    def setUp(self):
        """Set up database connection"""
        # Database connection details from environment
        self.db_host = os.getenv('DB_HOST', 'localhost')
        self.db_port = os.getenv('DB_PORT', '5432')
        self.db_name = os.getenv('DB_NAME', 'postgres')
        self.db_user = os.getenv('DB_USER', 'postgres')
        self.db_password = os.getenv('DB_PASSWORD', 'password')
        
        # Construct connection string
        self.connection_string = f"host={self.db_host} port={self.db_port} dbname={self.db_name} user={self.db_user} password={self.db_password}"
        
        try:
            self.conn = psycopg2.connect(self.connection_string)
            self.cursor = self.conn.cursor()
        except psycopg2.Error as e:
            self.skipTest(f"Could not connect to database: {e}")
    
    def tearDown(self):
        """Clean up database connection"""
        if hasattr(self, 'cursor'):
            self.cursor.close()
        if hasattr(self, 'conn'):
            self.conn.close()
    
    def test_required_tables_exist(self):
        """Test that all required tables exist"""
        required_tables = [
            'users', 'nodes', 'edges', 'user_unlocked_nodes', 
            'categories', 'node_categories'
        ]
        
        self.cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        """)
        
        existing_tables = [row[0] for row in self.cursor.fetchall()]
        
        for table in required_tables:
            self.assertIn(table, existing_tables, f"Required table '{table}' not found")
    
    def test_users_table_structure(self):
        """Test users table has correct structure"""
        self.cursor.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'users'
            ORDER BY ordinal_position
        """)
        
        columns = self.cursor.fetchall()
        column_names = [col[0] for col in columns]
        
        required_columns = ['id', 'email', 'name', 'created_at']
        for col in required_columns:
            self.assertIn(col, column_names, f"Required column '{col}' not found in users table")
        
        # Check specific column properties
        email_col = next((col for col in columns if col[0] == 'email'), None)
        self.assertIsNotNone(email_col)
        self.assertEqual(email_col[2], 'NO', "Email column should be NOT NULL")
    
    def test_nodes_table_structure(self):
        """Test nodes table has correct structure"""
        self.cursor.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'nodes'
            ORDER BY ordinal_position
        """)
        
        columns = self.cursor.fetchall()
        column_names = [col[0] for col in columns]
        
        required_columns = ['id', 'key', 'title', 'summary', 'video_url', 'is_root', 'order_index']
        for col in required_columns:
            self.assertIn(col, column_names, f"Required column '{col}' not found in nodes table")
    
    def test_edges_table_structure(self):
        """Test edges table has correct structure"""
        self.cursor.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'edges'
            ORDER BY ordinal_position
        """)
        
        columns = self.cursor.fetchall()
        column_names = [col[0] for col in columns]
        
        required_columns = ['id', 'parent_id', 'child_id', 'unlock_type', 'unlock_value']
        for col in required_columns:
            self.assertIn(col, column_names, f"Required column '{col}' not found in edges table")
    
    def test_foreign_key_constraints(self):
        """Test that foreign key constraints exist"""
        self.cursor.execute("""
            SELECT tc.constraint_name, tc.table_name, kcu.column_name, 
                   ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
        """)
        
        foreign_keys = self.cursor.fetchall()
        
        # Check that edges table has foreign keys to nodes
        edge_constraints = [fk for fk in foreign_keys if fk[1] == 'edges']
        parent_fk = any(fk[2] == 'parent_id' and fk[3] == 'nodes' for fk in edge_constraints)
        child_fk = any(fk[2] == 'child_id' and fk[3] == 'nodes' for fk in edge_constraints)
        
        self.assertTrue(parent_fk, "edges.parent_id should have foreign key to nodes")
        self.assertTrue(child_fk, "edges.child_id should have foreign key to nodes")
    
    def test_unique_constraints(self):
        """Test that unique constraints exist where expected"""
        self.cursor.execute("""
            SELECT tc.constraint_name, tc.table_name, kcu.column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.constraint_type = 'UNIQUE' AND tc.table_schema = 'public'
        """)
        
        unique_constraints = self.cursor.fetchall()
        
        # Check users.email is unique
        email_unique = any(uc[1] == 'users' and uc[2] == 'email' for uc in unique_constraints)
        self.assertTrue(email_unique, "users.email should have unique constraint")
        
        # Check nodes.key is unique
        key_unique = any(uc[1] == 'nodes' and uc[2] == 'key' for uc in unique_constraints)
        self.assertTrue(key_unique, "nodes.key should have unique constraint")


class TestDataIntegrity(unittest.TestCase):
    """Test data integrity and business rules"""
    
    def setUp(self):
        """Set up database connection"""
        # Database connection details from environment
        self.db_host = os.getenv('DB_HOST', 'localhost')
        self.db_port = os.getenv('DB_PORT', '5432')
        self.db_name = os.getenv('DB_NAME', 'postgres')
        self.db_user = os.getenv('DB_USER', 'postgres')
        self.db_password = os.getenv('DB_PASSWORD', 'password')
        
        # Construct connection string
        self.connection_string = f"host={self.db_host} port={self.db_port} dbname={self.db_name} user={self.db_user} password={self.db_password}"
        
        try:
            self.conn = psycopg2.connect(self.connection_string)
            self.cursor = self.conn.cursor()
        except psycopg2.Error as e:
            self.skipTest(f"Could not connect to database: {e}")
    
    def tearDown(self):
        """Clean up database connection"""
        if hasattr(self, 'cursor'):
            self.cursor.close()
        if hasattr(self, 'conn'):
            self.conn.close()
    
    def test_root_node_exists(self):
        """Test that exactly one root node exists"""
        self.cursor.execute("SELECT COUNT(*) FROM nodes WHERE is_root = true")
        root_count = self.cursor.fetchone()[0]
        self.assertEqual(root_count, 1, "Exactly one root node should exist")
        
        # Check that root node has key 'root'
        self.cursor.execute("SELECT key FROM nodes WHERE is_root = true")
        root_key = self.cursor.fetchone()
        if root_key:
            self.assertEqual(root_key[0], 'root', "Root node should have key 'root'")
    
    def test_no_orphaned_edges(self):
        """Test that all edges reference valid nodes"""
        self.cursor.execute("""
            SELECT COUNT(*) FROM edges e
            LEFT JOIN nodes n1 ON e.parent_id = n1.id
            LEFT JOIN nodes n2 ON e.child_id = n2.id
            WHERE n1.id IS NULL OR n2.id IS NULL
        """)
        
        orphaned_count = self.cursor.fetchone()[0]
        self.assertEqual(orphaned_count, 0, "No orphaned edges should exist")
    
    def test_valid_unlock_types(self):
        """Test that all edges have valid unlock types"""
        self.cursor.execute("""
            SELECT COUNT(*) FROM edges 
            WHERE unlock_type NOT IN ('always', 'manual', 'symptom_match')
        """)
        
        invalid_count = self.cursor.fetchone()[0]
        self.assertEqual(invalid_count, 0, "All edges should have valid unlock types")
    
    def test_no_self_referencing_edges(self):
        """Test that no edges reference the same node as parent and child"""
        self.cursor.execute("SELECT COUNT(*) FROM edges WHERE parent_id = child_id")
        self_ref_count = self.cursor.fetchone()[0]
        self.assertEqual(self_ref_count, 0, "No self-referencing edges should exist")
    
    def test_categories_have_nodes(self):
        """Test that all categories are associated with at least one node"""
        self.cursor.execute("""
            SELECT COUNT(*) FROM categories c
            LEFT JOIN node_categories nc ON c.name = nc.category
            WHERE nc.category IS NULL
        """)
        
        unused_categories = self.cursor.fetchone()[0]
        self.assertEqual(unused_categories, 0, "All categories should be associated with nodes")
    
    def test_node_categories_reference_valid_data(self):
        """Test that node_categories references valid nodes and categories"""
        # Check for valid node references
        self.cursor.execute("""
            SELECT COUNT(*) FROM node_categories nc
            LEFT JOIN nodes n ON nc.node_id = n.id
            WHERE n.id IS NULL
        """)
        
        invalid_nodes = self.cursor.fetchone()[0]
        self.assertEqual(invalid_nodes, 0, "All node_categories should reference valid nodes")
        
        # Check for valid category references
        self.cursor.execute("""
            SELECT COUNT(*) FROM node_categories nc
            LEFT JOIN categories c ON nc.category = c.name
            WHERE c.name IS NULL
        """)
        
        invalid_categories = self.cursor.fetchone()[0]
        self.assertEqual(invalid_categories, 0, "All node_categories should reference valid categories")
    
    def test_user_unlocks_reference_valid_data(self):
        """Test that user_unlocked_nodes references valid users and nodes"""
        # Check for valid user references
        self.cursor.execute("""
            SELECT COUNT(*) FROM user_unlocked_nodes uun
            LEFT JOIN users u ON uun.user_id = u.id
            WHERE u.id IS NULL
        """)
        
        invalid_users = self.cursor.fetchone()[0]
        self.assertEqual(invalid_users, 0, "All user unlocks should reference valid users")
        
        # Check for valid node references
        self.cursor.execute("""
            SELECT COUNT(*) FROM user_unlocked_nodes uun
            LEFT JOIN nodes n ON uun.node_id = n.id
            WHERE n.id IS NULL
        """)
        
        invalid_nodes = self.cursor.fetchone()[0]
        self.assertEqual(invalid_nodes, 0, "All user unlocks should reference valid nodes")


if __name__ == '__main__':
    unittest.main()
