/**
 * @fileoverview Admin users management page
 * Provides user listing, creation, editing, suspension, reactivation, and role management
 */

import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi, groupsApi } from '../lib/api'
import { translateError } from '../lib/errorHelper'
import { useFormatters } from '../hooks/useFormatters'
import {
  Plus, Search, X,
  ChevronDown, Pencil, Trash2, UserPlus,
  Power, RotateCcw, AlertTriangle
} from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import PasswordInput from '../components/PasswordInput'
import FormLanguageSelect from '../components/FormLanguageSelect'
import { useToast } from '../components/Toast'

/**
 * Modal form for creating or editing a user
 * Groups are managed locally (form-based) in both create and edit modes.
 * All group changes are submitted together with user data on save.
 * @param {Object} props
 * @param {Object|null} props.user - User to edit (null = create mode)
 * @param {Array} props.userGroups - Current user's group memberships (edit mode)
 * @param {Function} props.onClose - Close callback
 * @param {Function} props.onSave - Save callback with form data (includes groupChanges in edit mode)
 * @param {Array} props.groups - Available groups list
 */
function UserModal({ user, userGroups, onClose, onSave, groups, appDefaultLocale }) {
  const { t } = useTranslation()
  const isEdit = !!user
  const [formData, setFormData] = useState({
    email: user?.email || '',
    password: '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    role: user?.role || 'user',
    groupId: '',
    locale: user?.locale || appDefaultLocale || 'pt',
    currency: user?.currency || 'BRL',
  })
  // Pending groups for create mode (admin role)
  const [pendingGroups, setPendingGroups] = useState([])
  // Local groups for edit mode (form-based, submitted on save)
  const [localGroups, setLocalGroups] = useState([])
  const [hasLocalGroupChanges, setHasLocalGroupChanges] = useState(false)
  const [showAddGroup, setShowAddGroup] = useState(false)
  const [addGroupId, setAddGroupId] = useState('')
  const [addGroupRole, setAddGroupRole] = useState('member')

  // Sync localGroups from server data until user makes local changes
  // Normalize memberRole → role for consistent access in the component
  useEffect(() => {
    if (isEdit && !hasLocalGroupChanges) {
      setLocalGroups((userGroups || []).map(g => ({
        ...g,
        role: g.memberRole || g.role || 'member',
      })))
    }
  }, [isEdit, userGroups, hasLocalGroupChanges])

  /** Handles role change with group state transitions */
  const handleRoleChange = (newRole) => {
    const oldRole = formData.role

    if (!isEdit) {
      if (newRole === 'super_admin') {
        // Clear all group selections
        setPendingGroups([])
        setFormData({ ...formData, role: newRole, groupId: '' })
        setShowAddGroup(false)
        return
      }

      if (newRole === 'user') {
        // Switching to user: keep only the first pending group as simple groupId
        if (oldRole === 'admin' && pendingGroups.length > 0) {
          setFormData({ ...formData, role: newRole, groupId: pendingGroups[0].groupId })
        } else {
          setFormData({ ...formData, role: newRole })
        }
        setPendingGroups([])
        setShowAddGroup(false)
        return
      }

      if (newRole === 'admin') {
        // Switching to admin: migrate simple groupId to pendingGroups
        if (oldRole === 'user' && formData.groupId) {
          setPendingGroups([{ groupId: formData.groupId, role: 'member' }])
          setFormData({ ...formData, role: newRole, groupId: '' })
        } else {
          setFormData({ ...formData, role: newRole })
        }
        return
      }
    }

    setFormData({ ...formData, role: newRole })
  }

  /** Computes the diff between original userGroups and current localGroups */
  const computeGroupChanges = () => {
    const original = (userGroups || []).map(g => ({ ...g, role: g.memberRole || g.role || 'member' }))
    const current = localGroups
    const originalIds = new Set(original.map(g => g.id))
    const currentIds = new Set(current.map(g => g.id))

    const toAdd = current.filter(g => !originalIds.has(g.id))
      .map(g => ({ groupId: g.id, role: g.role }))
    const toRemove = original.filter(g => !currentIds.has(g.id))
      .map(g => g.id)
    const toUpdateRole = current.filter(g => {
      const orig = original.find(og => og.id === g.id)
      return orig && orig.role !== g.role
    }).map(g => ({ groupId: g.id, role: g.role }))

    return { toAdd, toRemove, toUpdateRole }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (isEdit) {
      // Only send changed fields
      const changes = {}
      if (formData.email !== user.email) changes.email = formData.email
      if (formData.firstName !== (user.firstName || '')) changes.firstName = formData.firstName
      if (formData.lastName !== (user.lastName || '')) changes.lastName = formData.lastName
      if (formData.role !== user.role) changes.role = formData.role
      if (formData.locale !== user.locale) changes.locale = formData.locale
      if (formData.currency !== user.currency) changes.currency = formData.currency

      // Compute group changes
      const groupChanges = computeGroupChanges()
      const hasGroupChanges = groupChanges.toAdd.length > 0 ||
        groupChanges.toRemove.length > 0 ||
        groupChanges.toUpdateRole.length > 0

      if (hasGroupChanges) {
        changes.groupChanges = groupChanges
      }

      if (Object.keys(changes).length > 0) {
        onSave(changes)
      } else {
        onClose()
      }
    } else {
      const data = { ...formData }
      if (!data.firstName) delete data.firstName
      if (!data.lastName) delete data.lastName
      if (!data.groupId) delete data.groupId
      // Attach pendingGroups for admin role so the parent can process them
      if (formData.role === 'admin' && pendingGroups.length > 0) {
        data.pendingGroups = pendingGroups
      }
      onSave(data)
    }
  }

  // Groups not yet assigned (excludes both edit localGroups and create pendingGroups)
  const currentGroupIds = isEdit
    ? localGroups.map(g => g.id)
    : []
  const pendingGroupIds = pendingGroups.map(pg => pg.groupId)
  const availableGroups = (groups || []).filter(g =>
    !currentGroupIds.includes(g.id) && !pendingGroupIds.includes(g.id)
  )

  const handleAddGroup = () => {
    if (addGroupId) {
      if (isEdit) {
        // Edit mode: add to localGroups
        const group = (groups || []).find(g => g.id === addGroupId)
        setLocalGroups([...localGroups, { id: addGroupId, name: group?.name || addGroupId, role: addGroupRole }])
        setHasLocalGroupChanges(true)
      } else {
        // Create mode admin: add to pendingGroups
        setPendingGroups([...pendingGroups, { groupId: addGroupId, role: addGroupRole }])
      }
      setShowAddGroup(false)
      setAddGroupId('')
      setAddGroupRole('member')
    }
  }

  /** Removes a group locally */
  const handleRemoveGroup = (groupId) => {
    if (isEdit) {
      setLocalGroups(localGroups.filter(g => g.id !== groupId))
      setHasLocalGroupChanges(true)
    } else {
      setPendingGroups(pendingGroups.filter(pg => pg.groupId !== groupId))
    }
  }

  /** Updates a group role locally */
  const handleUpdateGroupRole = (groupId, newRole) => {
    if (isEdit) {
      setLocalGroups(localGroups.map(g =>
        g.id === groupId ? { ...g, role: newRole } : g
      ))
      setHasLocalGroupChanges(true)
    } else {
      setPendingGroups(pendingGroups.map(pg =>
        pg.groupId === groupId ? { ...pg, role: newRole } : pg
      ))
    }
  }

  /** Resolves a group name from its ID */
  const getGroupName = (groupId) => {
    const group = (groups || []).find(g => g.id === groupId)
    return group ? group.name : groupId
  }

  // For user role: simple dropdown value and handler (both modes)
  const userGroupId = isEdit
    ? (localGroups[0]?.id || '')
    : formData.groupId

  const handleUserGroupChange = (newGroupId) => {
    if (isEdit) {
      if (newGroupId) {
        const group = (groups || []).find(g => g.id === newGroupId)
        const existingRole = localGroups[0]?.role || 'member'
        setLocalGroups([{ id: newGroupId, name: group?.name || newGroupId, role: existingRole }])
      } else {
        setLocalGroups([])
      }
      setHasLocalGroupChanges(true)
    } else {
      setFormData({ ...formData, groupId: newGroupId })
    }
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{isEdit ? t('admin.users.editUser') : t('admin.users.newUser')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.firstName')}</label>
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.lastName')}</label>
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.email')}</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              required
            />
          </div>
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.password')}</label>
              <PasswordInput
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="input"
                required
                minLength={8}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.role')}</label>
            <select
              value={formData.role}
              onChange={(e) => handleRoleChange(e.target.value)}
              className="input"
            >
              <option value="user">{t('admin.users.roles.user')}</option>
              <option value="admin">{t('admin.users.roles.admin')}</option>
              <option value="super_admin">{t('admin.users.roles.super_admin')}</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.language')}</label>
              <FormLanguageSelect
                value={formData.locale}
                onChange={(locale) => setFormData({ ...formData, locale })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.currency')}</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="input"
              >
                <option value="BRL">BRL</option>
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
          </div>
          {/* Simple group dropdown: user role (both create and edit) */}
          {formData.role === 'user' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.group')}</label>
              <select
                value={userGroupId}
                onChange={(e) => handleUserGroupChange(e.target.value)}
                className="input"
              >
                <option value="">{t('admin.users.noGroup')}</option>
                {groups?.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Multi-group management: admin role only (both create and edit) */}
          {formData.role === 'admin' && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">{t('admin.users.form.groups')}</label>
                {availableGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAddGroup(!showAddGroup)}
                    className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                  >
                    <UserPlus className="w-4 h-4" />
                    {t('admin.users.addGroup')}
                  </button>
                )}
              </div>

              {/* Add to group sub-form */}
              {showAddGroup && (
                <div className="flex items-end gap-2 mb-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 mb-1">{t('admin.users.form.group')}</label>
                    <select
                      value={addGroupId}
                      onChange={(e) => setAddGroupId(e.target.value)}
                      className="input text-sm"
                    >
                      <option value="">{t('admin.users.chooseGroup')}</option>
                      {availableGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{t('admin.users.form.role')}</label>
                    <select
                      value={addGroupRole}
                      onChange={(e) => setAddGroupRole(e.target.value)}
                      className="input text-sm"
                    >
                      <option value="member">{t('admin.users.groupRoles.member')}</option>
                      <option value="admin">{t('admin.users.groupRoles.admin')}</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddGroup}
                    disabled={!addGroupId}
                    className="btn btn-primary btn-sm text-sm px-3 py-2"
                  >
                    {t('common.ok')}
                  </button>
                </div>
              )}

              {/* Groups list: pendingGroups (create) or localGroups (edit) */}
              {(() => {
                const groupsList = isEdit
                  ? localGroups.map(g => ({ key: g.id, id: g.id, name: g.name, role: g.role }))
                  : pendingGroups.map(pg => ({ key: pg.groupId, id: pg.groupId, name: getGroupName(pg.groupId), role: pg.role }))

                if (groupsList.length > 0) {
                  return (
                    <div className="space-y-2">
                      {groupsList.map((g) => (
                        <div key={g.key} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <span className="text-sm font-medium text-gray-900">{g.name}</span>
                          <div className="flex items-center gap-2">
                            <select
                              value={g.role}
                              onChange={(e) => handleUpdateGroupRole(g.id, e.target.value)}
                              className="text-xs border rounded px-2 py-1"
                            >
                              <option value="member">{t('admin.users.groupRoles.member')}</option>
                              <option value="admin">{t('admin.users.groupRoles.admin')}</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => handleRemoveGroup(g.id)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded"
                              title={t('admin.users.removeFromGroup')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                }
                return <p className="text-sm text-gray-400 italic">{t('admin.users.noGroup')}</p>
              })()}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              {isEdit ? t('common.save') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

/**
 * Dropdown for changing user role
 * @param {Object} props
 * @param {Object} props.user - User object
 * @param {Function} props.onChangeRole - Callback with new role
 */
function RoleDropdown({ user, onChangeRole }) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  /** Role display configuration */
  const roleBadges = {
    super_admin: { label: t('admin.users.roles.super_admin'), classes: 'bg-purple-100 text-purple-700' },
    admin: { label: t('admin.users.roles.admin'), classes: 'bg-blue-100 text-blue-700' },
    user: { label: t('admin.users.roles.user'), classes: 'bg-gray-100 text-gray-700' },
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm hover:bg-gray-100 rounded px-2 py-1"
      >
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${roleBadges[user.role]?.classes || roleBadges.user.classes}`}>
          {roleBadges[user.role]?.label || user.role}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-40 bg-white rounded-lg shadow-lg border z-20 py-1">
            {Object.entries(roleBadges).map(([role, { label }]) => (
              <button
                key={role}
                onClick={() => {
                  if (role !== user.role) onChangeRole(role)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${role === user.role ? 'font-semibold bg-gray-50' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/**
 * Admin users management page
 * Lists all users with filtering, creation, editing, suspension, and role management
 */
export default function AdminUsers() {
  const { t } = useTranslation()
  const { formatDate } = useFormatters()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const queryClient = useQueryClient()
  const toast = useToast()

  /** Status display configuration */
  const statusBadges = {
    active: { label: t('admin.users.statuses.active'), classes: 'bg-green-100 text-green-700' },
    suspended: { label: t('admin.users.statuses.suspended'), classes: 'bg-red-100 text-red-700' },
  }

  const filters = {
    ...(search && { search }),
    ...(roleFilter && { role: roleFilter }),
    ...(statusFilter && { status: statusFilter }),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', filters],
    queryFn: () => adminApi.getUsers(filters).then(r => r.data),
  })

  const { data: groupsData } = useQuery({
    queryKey: ['admin-groups'],
    queryFn: () => groupsApi.getAll().then(r => r.data),
  })

  const { data: settingsData } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings().then(r => r.data),
  })

  const appDefaultLocale = settingsData?.data?.defaultLocale || 'pt'

  // Fetch user details (with groups) when editing
  const { data: userDetailData } = useQuery({
    queryKey: ['admin-user', editingUser?.id],
    queryFn: () => adminApi.getUser(editingUser.id).then(r => r.data),
    enabled: !!editingUser,
  })

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const { pendingGroups: pg, ...userData } = data
      const res = await adminApi.createUser(userData)
      // Chain addMember calls for pending groups (admin multi-group)
      if (pg && pg.length > 0) {
        const userId = res.data.data.user.id
        for (const g of pg) {
          await groupsApi.addMember(g.groupId, { userId, role: g.role })
        }
      }
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      setModalOpen(false)
      toast.success(t('admin.users.created'))
    },
    onError: (err) => {
      toast.error(translateError(err))
    },
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const { groupChanges, ...userData } = data
      // Update user fields if any
      let res
      if (Object.keys(userData).length > 0) {
        res = await adminApi.updateUser(id, userData)
      }
      // Apply batch group changes
      if (groupChanges) {
        for (const gId of groupChanges.toRemove) {
          await groupsApi.removeMember(gId, id)
        }
        for (const g of groupChanges.toAdd) {
          await groupsApi.addMember(g.groupId, { userId: id, role: g.role })
        }
        for (const g of groupChanges.toUpdateRole) {
          await groupsApi.updateMember(g.groupId, id, g.role)
        }
      }
      return res
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      queryClient.invalidateQueries({ queryKey: ['admin-user', editingUser?.id] })
      setEditingUser(null)
      toast.success(t('admin.users.updated'))
    },
    onError: (err) => {
      toast.error(translateError(err))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('admin.users.deleted'))
      setPermanentDeleteUser(null)
    },
    onError: (err) => {
      toast.error(translateError(err))
    },
  })

  const suspendMutation = useMutation({
    mutationFn: adminApi.suspendUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('admin.users.suspended'))
    },
    onError: (err) => toast.error(translateError(err)),
  })

  const reactivateMutation = useMutation({
    mutationFn: adminApi.reactivateUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('admin.users.reactivated'))
    },
    onError: (err) => toast.error(translateError(err)),
  })

  const [permanentDeleteUser, setPermanentDeleteUser] = useState(null)
  const [pendingConfirm, setPendingConfirm] = useState(null) // { type: 'suspend' | 'reactivate', user }

  const roleMutation = useMutation({
    mutationFn: ({ id, role }) => adminApi.updateUserRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success(t('admin.users.roleUpdated'))
    },
    onError: (err) => {
      toast.error(translateError(err))
    },
  })

  const users = data?.data || []

  // Resolve user detail data for the edit modal
  const editUserDetail = userDetailData?.data?.user || editingUser
  const editUserGroups = userDetailData?.data?.groups || []

  const openEditModal = (user) => {
    setEditingUser(user)
  }

  const closeEditModal = () => {
    setEditingUser(null)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.users.title')}</h1>
          <p className="text-gray-600">{t('admin.users.subtitle')}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn btn-primary flex items-center gap-2">
          <Plus className="w-5 h-5" />
          {t('admin.users.newUser')}
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('admin.users.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="">{t('admin.users.allRoles')}</option>
            <option value="super_admin">{t('admin.users.roles.super_admin')}</option>
            <option value="admin">{t('admin.users.roles.admin')}</option>
            <option value="user">{t('admin.users.roles.user')}</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input w-auto"
          >
            <option value="">{t('admin.users.allStatuses')}</option>
            <option value="active">{t('admin.users.statuses.active')}</option>
            <option value="suspended">{t('admin.users.statuses.suspended')}</option>
          </select>
        </div>
      </div>

      {/* Users table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left p-4 text-sm font-medium text-gray-500">{t('admin.users.tableHeaders.name')}</th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">{t('admin.users.tableHeaders.email')}</th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">{t('admin.users.tableHeaders.role')}</th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">{t('admin.users.tableHeaders.status')}</th>
                <th className="text-left p-4 text-sm font-medium text-gray-500">{t('admin.users.tableHeaders.createdAt')}</th>
                <th className="text-right p-4 text-sm font-medium text-gray-500">{t('admin.users.tableHeaders.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">
                    {t('admin.users.noUsers')}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-gray-900">
                            {u.firstName || u.lastName
                              ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
                              : '-'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-gray-600">{u.email}</td>
                    <td className="p-4">
                      <RoleDropdown
                        user={u}
                        onChangeRole={(role) => roleMutation.mutate({ id: u.id, role })}
                      />
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusBadges[u.status]?.classes || statusBadges.active.classes}`}>
                        {statusBadges[u.status]?.label || u.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {u.createdAt ? formatDate(u.createdAt) : '-'}
                    </td>
                    <td className="p-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => openEditModal(u)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                          title={t('common.edit')}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {u.isActive ? (
                          <button
                            onClick={() => setPendingConfirm({ type: 'suspend', user: u })}
                            className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title={t('admin.users.suspend')}
                          >
                            <Power className="w-4 h-4" />
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setPendingConfirm({ type: 'reactivate', user: u })}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title={t('admin.users.reactivate')}
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setPermanentDeleteUser(u)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title={t('admin.users.permanentDelete')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create user modal */}
      {modalOpen && (
        <UserModal
          user={null}
          userGroups={[]}
          onClose={() => setModalOpen(false)}
          onSave={(data) => createMutation.mutate(data)}
          groups={groupsData?.data || []}
          appDefaultLocale={appDefaultLocale}
        />
      )}

      {/* Edit user modal */}
      {editingUser && (
        <UserModal
          // Remount once the authoritative user detail has loaded so the form
          // re-initializes from the full record instead of the list summary.
          key={userDetailData ? `${editingUser.id}-detail` : `${editingUser.id}-summary`}
          user={editUserDetail}
          userGroups={editUserGroups}
          onClose={closeEditModal}
          onSave={(data) => updateMutation.mutate({ id: editingUser.id, data })}
          groups={groupsData?.data || []}
          appDefaultLocale={appDefaultLocale}
        />
      )}

      {permanentDeleteUser && (
        <PermanentDeleteUserModal
          user={permanentDeleteUser}
          onClose={() => setPermanentDeleteUser(null)}
          onConfirm={() => deleteMutation.mutate(permanentDeleteUser.id)}
          isPending={deleteMutation.isPending}
        />
      )}

      {pendingConfirm?.type === 'suspend' && (
        <ConfirmModal
          variant="warning"
          icon={Power}
          title={t('admin.users.suspend')}
          message={t('admin.users.confirmSuspend', { email: pendingConfirm.user.email })}
          confirmLabel={t('admin.users.suspend')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            suspendMutation.mutate(pendingConfirm.user.id)
            setPendingConfirm(null)
          }}
          onClose={() => setPendingConfirm(null)}
          isPending={suspendMutation.isPending}
        />
      )}

      {pendingConfirm?.type === 'reactivate' && (
        <ConfirmModal
          variant="success"
          icon={RotateCcw}
          title={t('admin.users.reactivate')}
          message={t('admin.users.confirmReactivate', { email: pendingConfirm.user.email })}
          confirmLabel={t('admin.users.reactivate')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            reactivateMutation.mutate(pendingConfirm.user.id)
            setPendingConfirm(null)
          }}
          onClose={() => setPendingConfirm(null)}
          isPending={reactivateMutation.isPending}
        />
      )}
    </div>
  )
}

/**
 * Strong-confirmation modal for permanent user deletion.
 * Requires the user to retype the target email to enable the confirm button.
 */
function PermanentDeleteUserModal({ user, onClose, onConfirm, isPending }) {
  const { t } = useTranslation()
  const [typed, setTyped] = useState('')
  const canConfirm = typed.trim().toLowerCase() === user.email.toLowerCase() && !isPending

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h2 className="text-lg font-semibold text-red-700">{t('admin.users.permanentDelete')}</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 space-y-2">
            <p className="font-semibold">{t('admin.users.permanentDeleteWarningTitle')}</p>
            <p>{t('admin.users.permanentDeleteWarningBody', { email: user.email })}</p>
            <ul className="list-disc list-inside text-xs space-y-0.5 pt-1">
              <li>{t('admin.users.permanentDeleteList.accounts')}</li>
              <li>{t('admin.users.permanentDeleteList.transactions')}</li>
              <li>{t('admin.users.permanentDeleteList.recurring')}</li>
              <li>{t('admin.users.permanentDeleteList.memberships')}</li>
            </ul>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-1">
              {t('admin.users.permanentDeleteTypeEmail', { email: user.email })}
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="input w-full"
              placeholder={user.email}
              autoFocus
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button type="button" onClick={onClose} className="btn">
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className="btn bg-red-600 hover:bg-red-700 text-white flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
            {t('admin.users.permanentDeleteConfirm')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
