"""
Database Data Integrity Tests via Supabase API
"""
import unittest
import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()  # Load from tests/.env for local testing
# In CI/CD, environment variables are provided by GitHub Secrets

class TestDataIntegrity(unittest.TestCase):
    """Test data integrity through Supabase API"""
    
    def setUp(self):
        """Set up Supabase connection"""
        self.supabase_url = os.getenv('NEXT_PUBLIC_SUPABASE_URL')
        self.service_role_key = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
        
        if not self.supabase_url or not self.service_role_key:
            self.skipTest("Supabase credentials not available")
        
        self.headers = {
            'apikey': self.service_role_key,
            'Authorization': f'Bearer {self.service_role_key}',
            'Content-Type': 'application/json'
        }
        
        self.rest_url = f"{self.supabase_url}/rest/v1"
    
    def _get_data(self, table, params=""):
        """Get data from a table via Supabase API"""
        try:
            response = requests.get(
                f"{self.rest_url}/{table}{params}",
                headers=self.headers
            )
            if response.status_code == 200:
                return response.json()
            return None
        except Exception:
            return None
    
    def test_required_tables_accessible(self):
        """Test that all required tables are accessible"""
        required_tables = [
            'users', 'nodes', 'edges', 'user_unlocked_nodes', 
            'categories', 'node_categories'
        ]
        
        for table in required_tables:
            data = self._get_data(table, "?limit=1")
            self.assertIsNotNone(data, f"Table '{table}' not accessible")
            self.assertIsInstance(data, list, f"Table '{table}' should return array")
    
    def test_root_node_exists(self):
        """Test that exactly one root node exists"""
        root_nodes = self._get_data('nodes', "?is_root=eq.true")
        
        if root_nodes is not None:
            self.assertEqual(len(root_nodes), 1, "Exactly one root node should exist")
            
            # Check that root node has key 'root'
            if len(root_nodes) > 0:
                self.assertEqual(root_nodes[0]['key'], 'root', "Root node should have key 'root'")
    
    def test_nodes_have_required_fields(self):
        """Test that nodes have required fields"""
        nodes = self._get_data('nodes', "?limit=5")
        
        if nodes and len(nodes) > 0:
            required_fields = ['id', 'key', 'title']
            for node in nodes:
                for field in required_fields:
                    self.assertIn(field, node, f"Node missing required field: {field}")
                    self.assertIsNotNone(node[field], f"Node field {field} should not be null")
    
    def test_edges_reference_valid_nodes(self):
        """Test that edges reference valid nodes"""
        edges = self._get_data('edges', "?limit=10")
        nodes = self._get_data('nodes', "?select=id")
        
        if edges and nodes:
            node_ids = {node['id'] for node in nodes}
            
            for edge in edges:
                self.assertIn(edge['parent_id'], node_ids, 
                            f"Edge parent_id {edge['parent_id']} references non-existent node")
                self.assertIn(edge['child_id'], node_ids, 
                            f"Edge child_id {edge['child_id']} references non-existent node")
    
    def test_valid_unlock_types(self):
        """Test that all edges have valid unlock types"""
        edges = self._get_data('edges')
        
        if edges:
            valid_types = {'always', 'manual', 'symptom_match'}
            for edge in edges:
                self.assertIn(edge['unlock_type'], valid_types, 
                            f"Invalid unlock type: {edge['unlock_type']}")
    
    def test_no_self_referencing_edges(self):
        """Test that no edges reference the same node as parent and child"""
        edges = self._get_data('edges')
        
        if edges:
            for edge in edges:
                self.assertNotEqual(edge['parent_id'], edge['child_id'], 
                                  "Edge should not reference same node as parent and child")
    
    def test_categories_exist(self):
        """Test that categories exist and are used"""
        categories = self._get_data('categories')
        node_categories = self._get_data('node_categories')
        
        if categories and node_categories:
            category_names = {cat['name'] for cat in categories}
            used_categories = {nc['category'] for nc in node_categories}
            
            # All used categories should be defined
            for used_cat in used_categories:
                self.assertIn(used_cat, category_names, 
                            f"Category '{used_cat}' used but not defined")
    
    def test_user_unlocks_reference_valid_data(self):
        """Test that user unlocks reference valid users and nodes"""
        unlocks = self._get_data('user_unlocked_nodes', "?limit=10")
        
        if unlocks and len(unlocks) > 0:
            users = self._get_data('users', "?select=id")
            nodes = self._get_data('nodes', "?select=id")
            
            if users and nodes:
                user_ids = {user['id'] for user in users}
                node_ids = {node['id'] for node in nodes}
                
                for unlock in unlocks:
                    self.assertIn(unlock['user_id'], user_ids, 
                                f"Unlock references non-existent user: {unlock['user_id']}")
                    self.assertIn(unlock['node_id'], node_ids, 
                                f"Unlock references non-existent node: {unlock['node_id']}")
    
    def test_basic_data_structure(self):
        """Test basic data structure expectations"""
        # Check we have some nodes
        nodes = self._get_data('nodes')
        if nodes is not None:
            self.assertGreater(len(nodes), 0, "Should have at least one node")
        
        # Check we have some edges
        edges = self._get_data('edges')
        if edges is not None:
            self.assertGreater(len(edges), 0, "Should have at least one edge")
        
        # Check we have categories
        categories = self._get_data('categories')
        if categories is not None:
            self.assertGreater(len(categories), 0, "Should have at least one category")


if __name__ == '__main__':
    unittest.main()
