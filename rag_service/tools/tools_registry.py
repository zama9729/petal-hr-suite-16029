"""
Tool Registry for RAG System - Provides database query tools for LLM
"""
import json
import logging
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

logger = logging.getLogger(__name__)


@dataclass
class ToolExecutionContext:
    """Security context for tool execution"""
    user_id: str
    tenant_id: str
    role: str


class ToolExecutionError(Exception):
    """Raised when tool execution fails"""
    pass


class ToolRegistry:
    """Registry of available tools for LLM to call"""
    
    def __init__(self, db_connector):
        """
        Initialize tool registry
        
        Args:
            db_connector: Database connection object (PostgresConnector or similar)
        """
        self.db_connector = db_connector
        self._tools = self._register_tools()
    
    def _register_tools(self) -> Dict[str, Dict[str, Any]]:
        """Register all available tools"""
        return {
            "get_employee_leave_balance": {
                "name": "get_employee_leave_balance",
                "description": "Get the leave balance for the current employee (vacation, sick, personal days)",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            "get_employee_payroll_info": {
                "name": "get_employee_payroll_info",
                "description": "Get payroll information for the current employee (salary, deductions, pay period)",
                "parameters": {
                    "type": "object",
                    "properties": {},
                    "required": []
                }
            },
            "get_department_headcount": {
                "name": "get_department_headcount",
                "description": "Get the number of employees in a specific department (HR/CEO only)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "department": {
                            "type": "string",
                            "description": "Department name"
                        }
                    },
                    "required": ["department"]
                }
            },
            "get_employees_on_leave": {
                "name": "get_employees_on_leave",
                "description": "Get list of employees currently on leave (HR/CEO only)",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "status": {
                            "type": "string",
                            "description": "Leave status filter (pending, approved, rejected)",
                            "enum": ["pending", "approved", "rejected"]
                        }
                    },
                    "required": []
                }
            },
            "submit_leave_request": {
                "name": "submit_leave_request",
                "description": "Submit a new leave request for the current employee",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "leave_type": {
                            "type": "string",
                            "description": "Type of leave (vacation, sick, personal, etc.)"
                        },
                        "start_date": {
                            "type": "string",
                            "description": "Start date in YYYY-MM-DD format"
                        },
                        "end_date": {
                            "type": "string",
                            "description": "End date in YYYY-MM-DD format"
                        },
                        "reason": {
                            "type": "string",
                            "description": "Reason for leave"
                        }
                    },
                    "required": ["leave_type", "start_date", "end_date"]
                }
            }
        }
    
    def get_openai_tools_schema(self, role) -> List[Dict[str, Any]]:
        """
        Get OpenAI function calling schema for available tools based on role
        
        Args:
            role: User role (employee, hr, ceo, etc.)
            
        Returns:
            List of tool schemas in OpenAI format
        """
        role_str = role.value if hasattr(role, 'value') else str(role).lower()
        
        # Role-based tool access
        if role_str in ["employee"]:
            # Employees can only access their own data and submit requests
            allowed_tools = [
                "get_employee_leave_balance",
                "get_employee_payroll_info",
                "submit_leave_request"
            ]
        elif role_str in ["hr", "ceo", "admin"]:
            # HR/CEO can access all tools
            allowed_tools = list(self._tools.keys())
        else:
            # Default: minimal access
            allowed_tools = ["get_employee_leave_balance"]
        
        # Convert to OpenAI format
        tools = []
        for tool_name in allowed_tools:
            if tool_name in self._tools:
                tool_def = self._tools[tool_name]
                tools.append({
                    "type": "function",
                    "function": {
                        "name": tool_def["name"],
                        "description": tool_def["description"],
                        "parameters": tool_def["parameters"]
                    }
                })
        
        return tools
    
    def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        context: ToolExecutionContext
    ) -> Dict[str, Any]:
        """
        Execute a tool with security context
        
        Args:
            tool_name: Name of the tool to execute
            arguments: Tool arguments
            context: Security context
            
        Returns:
            Tool execution result
            
        Raises:
            ToolExecutionError: If execution fails or access denied
        """
        if tool_name not in self._tools:
            raise ToolExecutionError(f"Unknown tool: {tool_name}")
        
        role_str = context.role.lower() if isinstance(context.role, str) else context.role.value.lower()
        
        # Security check: verify role has access
        if tool_name in ["get_department_headcount", "get_employees_on_leave"]:
            if role_str not in ["hr", "ceo", "admin"]:
                raise ToolExecutionError(f"Access denied: {tool_name} requires HR/CEO role")
        
        # Execute tool
        try:
            if tool_name == "get_employee_leave_balance":
                return self._get_employee_leave_balance(context)
            elif tool_name == "get_employee_payroll_info":
                return self._get_employee_payroll_info(context)
            elif tool_name == "get_department_headcount":
                return self._get_department_headcount(arguments.get("department"), context)
            elif tool_name == "get_employees_on_leave":
                return self._get_employees_on_leave(arguments.get("status"), context)
            elif tool_name == "submit_leave_request":
                return self._submit_leave_request(arguments, context)
            else:
                raise ToolExecutionError(f"Tool {tool_name} not implemented")
        except Exception as e:
            logger.error(f"Tool execution error: {e}")
            raise ToolExecutionError(f"Tool execution failed: {str(e)}")
    
    def _get_employee_leave_balance(self, context: ToolExecutionContext) -> Dict[str, Any]:
        """Get leave balance for current employee"""
        try:
            # Query database for leave balance
            query = """
                SELECT 
                    COALESCE(SUM(CASE WHEN leave_type = 'vacation' THEN days END), 0) as vacation_balance,
                    COALESCE(SUM(CASE WHEN leave_type = 'sick' THEN days END), 0) as sick_balance,
                    COALESCE(SUM(CASE WHEN leave_type = 'personal' THEN days END), 0) as personal_balance
                FROM leave_balances
                WHERE tenant_id = %s AND user_id = %s
            """
            # Note: This is a placeholder - implement actual DB query based on your schema
            # For now, return mock data
            return {
                "vacation_balance": 15,
                "sick_balance": 10,
                "personal_balance": 5,
                "user_id": context.user_id,
                "tenant_id": context.tenant_id
            }
        except Exception as e:
            logger.error(f"Error fetching leave balance: {e}")
            raise ToolExecutionError(f"Failed to fetch leave balance: {str(e)}")
    
    def _get_employee_payroll_info(self, context: ToolExecutionContext) -> Dict[str, Any]:
        """Get payroll info for current employee"""
        try:
            # Placeholder - implement actual DB query
            return {
                "salary": 50000,
                "pay_period": "monthly",
                "deductions": 5000,
                "net_pay": 45000,
                "user_id": context.user_id
            }
        except Exception as e:
            logger.error(f"Error fetching payroll info: {e}")
            raise ToolExecutionError(f"Failed to fetch payroll info: {str(e)}")
    
    def _get_department_headcount(self, department: Optional[str], context: ToolExecutionContext) -> Dict[str, Any]:
        """Get department headcount (HR/CEO only)"""
        try:
            # Placeholder - implement actual DB query
            query = """
                SELECT COUNT(*) as count
                FROM employees
                WHERE tenant_id = %s AND is_active = true
            """
            if department:
                query += " AND department = %s"
            
            # For now, return mock data
            return {
                "department": department or "all",
                "headcount": 25,
                "tenant_id": context.tenant_id
            }
        except Exception as e:
            logger.error(f"Error fetching headcount: {e}")
            raise ToolExecutionError(f"Failed to fetch headcount: {str(e)}")
    
    def _get_employees_on_leave(self, status: Optional[str], context: ToolExecutionContext) -> Dict[str, Any]:
        """Get employees on leave (HR/CEO only)"""
        try:
            # Placeholder - implement actual DB query
            query = """
                SELECT user_id, name, leave_type, start_date, end_date, status
                FROM leave_requests
                WHERE tenant_id = %s
            """
            if status:
                query += " AND status = %s"
            
            # For now, return mock data
            return {
                "employees": [
                    {
                        "user_id": "emp_001",
                        "name": "John Doe",
                        "leave_type": "vacation",
                        "start_date": "2024-01-15",
                        "end_date": "2024-01-20",
                        "status": status or "approved"
                    }
                ],
                "count": 1,
                "tenant_id": context.tenant_id
            }
        except Exception as e:
            logger.error(f"Error fetching employees on leave: {e}")
            raise ToolExecutionError(f"Failed to fetch employees on leave: {str(e)}")
    
    def _submit_leave_request(self, arguments: Dict[str, Any], context: ToolExecutionContext) -> Dict[str, Any]:
        """Submit a leave request"""
        try:
            leave_type = arguments.get("leave_type")
            start_date = arguments.get("start_date")
            end_date = arguments.get("end_date")
            reason = arguments.get("reason", "")
            
            if not all([leave_type, start_date, end_date]):
                raise ToolExecutionError("Missing required fields: leave_type, start_date, end_date")
            
            # Placeholder - implement actual DB insert
            return {
                "status": "submitted",
                "request_id": f"LR_{int(datetime.utcnow().timestamp())}",
                "leave_type": leave_type,
                "start_date": start_date,
                "end_date": end_date,
                "reason": reason,
                "user_id": context.user_id,
                "tenant_id": context.tenant_id
            }
        except Exception as e:
            logger.error(f"Error submitting leave request: {e}")
            raise ToolExecutionError(f"Failed to submit leave request: {str(e)}")


