/**
 * @fileoverview Admin groups management page
 * Provides group listing, creation, editing, deletion, and member management
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { groupsApi, adminApi } from '../lib/api'
import { translateError } from '../lib/errorHelper'
import { useAuth } from '../contexts/AuthContext'
import {
  Plus, X, Trash2, Pencil, Users, UserPlus,
  ChevronDown, ChevronUp, FolderTree, UserMinus
} from 'lucide-react'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import PasswordInput from '../components/PasswordInput'
import FormLanguageSelect from '../components/FormLanguageSelect'
import { useToast } from '../components/Toast'

/**
 * Modal form for creating or editing a group
 * @param {Object} props
 * @param {Object|null} props.group - Existing group for editing, null for creation
 * @param {Function} props.onClose - Close callback
 * @param {Function} props.onSave - Save callback with form data
 */
function GroupModal({ group, onClose, onSave, appDefaults }) {
  const { t } = useTranslation()
  const [formData, setFormData] = useState({
    name: group?.name || '',
    description: group?.description || '',
    defaultLocale: group?.defaultLocale || appDefaults?.defaultLocale || 'pt',
    defaultDecimalSeparator: group?.defaultDecimalSeparator || appDefaults?.defaultDecimalSeparator || ',',
    defaultDigitGrouping: group?.defaultDigitGrouping || appDefaults?.defaultDigitGrouping || ' ',
  })

  const toast = useToast()

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.defaultDigitGrouping && formData.defaultDigitGrouping === formData.defaultDecimalSeparator) {
      toast.error(t('settings.preferences.sameSeparatorError'))
      return
    }
    onSave(formData)
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">
            {group ? t('admin.groups.editGroup') : t('admin.groups.newGroup')}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')}</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="input"
              rows={3}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.groups.defaultLocale')}</label>
            <p className="text-xs text-gray-500 mb-1">{t('admin.groups.defaultLocaleDesc')}</p>
            <FormLanguageSelect
              value={formData.defaultLocale}
              onChange={(locale) => setFormData({ ...formData, defaultLocale: locale })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.groups.defaultDecimalSeparator')}</label>
            <select
              value={formData.defaultDecimalSeparator}
              onChange={(e) => setFormData({ ...formData, defaultDecimalSeparator: e.target.value })}
              className="input"
            >
              <option value=",">{t('settings.preferences.decimalSeparators.comma')}</option>
              <option value=".">{t('settings.preferences.decimalSeparators.dot')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.groups.defaultDigitGrouping')}</label>
            <select
              value={formData.defaultDigitGrouping}
              onChange={(e) => setFormData({ ...formData, defaultDigitGrouping: e.target.value })}
              className="input"
            >
              <option value=" ">{t('settings.preferences.digitGroupings.space')}</option>
              <option value=",">{t('settings.preferences.digitGroupings.comma')}</option>
              <option value=".">{t('settings.preferences.digitGroupings.dot')}</option>
              <option value="">{t('settings.preferences.digitGroupings.none')}</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn-primary flex-1">
              {group ? t('common.edit') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  )
}

/**
 * Modal for adding a member to a group
 * Super admins see two tabs: existing user dropdown or inline creation form
 * Group admins only see the inline creation form (no user enumeration)
 * @param {Object} props
 * @param {string} props.groupId - Group UUID
 * @param {Function} props.onClose - Close callback
 * @param {Function} props.onSave - Save callback with member data
 * @param {Array} props.users - Available users list (super_admin only)
 * @param {Array} props.existingMemberIds - IDs of existing members to exclude
 * @param {boolean} props.isSuperAdmin - Whether current user is super_admin
 */
function AddMemberModal({ onClose, onSave, users, existingMemberIds, isSuperAdmin }) {
  const { t } = useTranslation()
  const [tab, setTab] = useState(isSuperAdmin ? 'existing' : 'new')
  const [formData, setFormData] = useState({
    userId: '',
    role: 'member',
  })
  const [newMemberData, setNewMemberData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'member',
    locale: 'pt',
    currency: 'BRL',
  })

  const availableUsers = users.filter((u) => !existingMemberIds.includes(u.id))

  const handleSubmitExisting = (e) => {
    e.preventDefault()
    if (!formData.userId) return
    onSave(formData)
  }

  const handleSubmitNew = (e) => {
    e.preventDefault()
    if (!newMemberData.email || !newMemberData.password) return
    onSave(newMemberData)
  }

  return (
    <Modal onClose={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{t('admin.groups.addMember')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs - only for super_admin */}
        {isSuperAdmin && (
          <div className="flex border-b">
            <button
              type="button"
              onClick={() => setTab('existing')}
              className={`flex-1 py-2 text-sm font-medium text-center transition-colors ${
                tab === 'existing'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('admin.groups.existingUser')}
            </button>
            <button
              type="button"
              onClick={() => setTab('new')}
              className={`flex-1 py-2 text-sm font-medium text-center transition-colors ${
                tab === 'new'
                  ? 'text-primary-600 border-b-2 border-primary-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t('admin.groups.newMember')}
            </button>
          </div>
        )}

        {/* Existing user tab */}
        {tab === 'existing' && isSuperAdmin && (
          <form onSubmit={handleSubmitExisting} className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.title')}</label>
              <select
                value={formData.userId}
                onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                className="input"
                required
              >
                <option value="">{t('admin.groups.selectUser')}</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName || u.lastName
                      ? `${u.firstName || ''} ${u.lastName || ''}`.trim()
                      : u.email}
                    {' '}({u.email})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.groups.groupRole')}</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="input"
              >
                <option value="member">{t('admin.users.groupRoles.member')}</option>
                <option value="admin">{t('admin.groups.administrator')}</option>
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary flex-1">
                {t('common.add')}
              </button>
            </div>
          </form>
        )}

        {/* New member inline creation tab */}
        {tab === 'new' && (
          <form onSubmit={handleSubmitNew} className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.firstName')}</label>
                <input
                  type="text"
                  value={newMemberData.firstName}
                  onChange={(e) => setNewMemberData({ ...newMemberData, firstName: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.lastName')}</label>
                <input
                  type="text"
                  value={newMemberData.lastName}
                  onChange={(e) => setNewMemberData({ ...newMemberData, lastName: e.target.value })}
                  className="input"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.email')}</label>
              <input
                type="email"
                value={newMemberData.email}
                onChange={(e) => setNewMemberData({ ...newMemberData, email: e.target.value })}
                className="input"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.password')}</label>
              <PasswordInput
                value={newMemberData.password}
                onChange={(e) => setNewMemberData({ ...newMemberData, password: e.target.value })}
                className="input"
                required
                minLength={8}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.language')}</label>
                <FormLanguageSelect
                  value={newMemberData.locale}
                  onChange={(locale) => setNewMemberData({ ...newMemberData, locale })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.users.form.currency')}</label>
                <select
                  value={newMemberData.currency}
                  onChange={(e) => setNewMemberData({ ...newMemberData, currency: e.target.value })}
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('admin.groups.groupRole')}</label>
              <select
                value={newMemberData.role}
                onChange={(e) => setNewMemberData({ ...newMemberData, role: e.target.value })}
                className="input"
              >
                <option value="member">{t('admin.users.groupRoles.member')}</option>
                <option value="admin">{t('admin.groups.administrator')}</option>
              </select>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn btn-secondary flex-1">
                {t('common.cancel')}
              </button>
              <button type="submit" className="btn btn-primary flex-1">
                {t('common.add')}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}

/**
 * Expandable group card with member management
 * @param {Object} props
 * @param {Object} props.group - Group object
 * @param {Function} props.onEdit - Edit callback
 * @param {Function} props.onDelete - Delete callback
 * @param {Array} props.users - Available users for adding members
 */
function GroupCard({ group, onEdit, onDelete, users, isSuperAdmin }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['group-members', group.id],
    queryFn: () => groupsApi.getMembers(group.id).then(r => r.data),
    enabled: expanded,
  })

  const addMemberMutation = useMutation({
    mutationFn: (data) => groupsApi.addMember(group.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', group.id] })
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] })
      setAddMemberOpen(false)
      toast.success(t('admin.groups.memberAdded'))
    },
    onError: (err) => {
      toast.error(translateError(err))
    },
  })

  const updateMemberMutation = useMutation({
    mutationFn: ({ userId, role }) => groupsApi.updateMember(group.id, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', group.id] })
      toast.success(t('admin.groups.memberRoleUpdated'))
    },
    onError: (err) => {
      toast.error(translateError(err))
    },
  })

  const deleteMemberMutation = useMutation({
    mutationFn: (userId) => groupsApi.removeMember(group.id, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['group-members', group.id] })
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] })
      toast.success(t('admin.groups.memberDeleted'))
      setRemoveMemberCandidate(null)
    },
    onError: (err) => {
      toast.error(translateError(err))
    },
  })

  const [removeMemberCandidate, setRemoveMemberCandidate] = useState(null)

  const members = membersData?.data || []
  const memberCount = group.memberCount ?? members.length

  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
            <FolderTree className="w-5 h-5 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{group.name}</h3>
            {group.description && (
              <p className="text-sm text-gray-500 mt-0.5">{group.description}</p>
            )}
            <div className="flex items-center gap-3 mt-2">
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Users className="w-3.5 h-3.5" />
                {t('admin.groups.memberCount', { count: memberCount })}
              </span>
              {group.status && (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  group.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {group.status === 'active' ? t('common.active') : t('common.inactive')}
                </span>
              )}
            </div>
          </div>
        </div>
        {isSuperAdmin && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(group)}
              className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              title={t('common.edit')}
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteConfirmOpen(true)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title={t('common.delete')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Expand/collapse members */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 mt-3 text-sm text-primary-600 hover:text-primary-700"
      >
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {expanded ? t('admin.groups.hideMembers') : t('admin.groups.showMembers')}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">{t('admin.groups.members')}</h4>
            <button
              onClick={() => setAddMemberOpen(true)}
              className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
            >
              <UserPlus className="w-4 h-4" />
              {t('common.add')}
            </button>
          </div>

          {membersLoading ? (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary-600"></div>
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-400 py-2">{t('admin.groups.noMembers')}</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.userId || member.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {member.firstName || member.lastName
                          ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
                          : member.email}
                      </p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role || 'member'}
                      onChange={(e) => updateMemberMutation.mutate({ userId: member.userId || member.id, role: e.target.value })}
                      className="text-xs border rounded px-2 py-1 text-gray-600"
                    >
                      <option value="member">{t('admin.users.groupRoles.member')}</option>
                      <option value="admin">{t('admin.users.groupRoles.admin')}</option>
                    </select>
                    <button
                      onClick={() => setRemoveMemberCandidate(member)}
                      className="p-1 text-gray-400 hover:text-red-600 rounded transition-colors"
                      title={t('admin.groups.removeMember')}
                    >
                      <UserMinus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {addMemberOpen && (
            <AddMemberModal
              onClose={() => setAddMemberOpen(false)}
              onSave={(data) => addMemberMutation.mutate(data)}
              users={users || []}
              existingMemberIds={members.map((m) => m.userId || m.id)}
              isSuperAdmin={isSuperAdmin}
            />
          )}

          {removeMemberCandidate && (
            <ConfirmModal
              variant="warning"
              icon={UserMinus}
              title={t('admin.groups.removeMember')}
              message={t('admin.groups.confirmDeleteMember', {
                email: removeMemberCandidate.email || '',
              })}
              confirmLabel={t('admin.groups.removeMember')}
              cancelLabel={t('common.cancel')}
              onConfirm={() => deleteMemberMutation.mutate(removeMemberCandidate.userId || removeMemberCandidate.id)}
              onClose={() => setRemoveMemberCandidate(null)}
              isPending={deleteMemberMutation.isPending}
            />
          )}
        </div>
      )}

      {deleteConfirmOpen && (
        <ConfirmModal
          variant="danger"
          title={t('common.delete')}
          message={t('admin.groups.confirmDelete', { name: group.name })}
          confirmLabel={t('common.delete')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            onDelete(group.id)
            setDeleteConfirmOpen(false)
          }}
          onClose={() => setDeleteConfirmOpen(false)}
        />
      )}
    </div>
  )
}

/**
 * Admin groups management page
 * Lists all groups with creation, editing, deletion, and member management
 */
export default function AdminGroups() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'super_admin'
  const [modalOpen, setModalOpen] = useState(false)
  const [editingGroup, setEditingGroup] = useState(null)
  const queryClient = useQueryClient()
  const toast = useToast()

  const { data, isLoading } = useQuery({
    queryKey: ['admin-groups'],
    queryFn: () => groupsApi.getAll().then(r => r.data),
  })

  const { data: usersData } = useQuery({
    queryKey: ['admin-users-all'],
    queryFn: () => adminApi.getUsers().then(r => r.data),
    enabled: isSuperAdmin,
  })

  const { data: settingsData } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: () => adminApi.getSettings().then(r => r.data),
    enabled: isSuperAdmin,
  })

  const appDefaults = {
    defaultLocale: settingsData?.data?.defaultLocale || 'pt',
    defaultDecimalSeparator: settingsData?.data?.defaultDecimalSeparator || ',',
    defaultDigitGrouping: settingsData?.data?.defaultDigitGrouping || ' ',
  }

  const createMutation = useMutation({
    mutationFn: groupsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] })
      setModalOpen(false)
      toast.success(t('admin.groups.created'))
    },
    onError: (err) => {
      toast.error(translateError(err))
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => groupsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] })
      setEditingGroup(null)
      toast.success(t('admin.groups.updated'))
    },
    onError: (err) => {
      toast.error(translateError(err))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: groupsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-groups'] })
      toast.success(t('admin.groups.deleted'))
    },
    onError: (err) => {
      toast.error(translateError(err))
    },
  })

  const handleSave = (formData) => {
    if (editingGroup) {
      updateMutation.mutate({ id: editingGroup.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const groups = data?.data || []

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
          <h1 className="text-2xl font-bold text-gray-900">{t('admin.groups.title')}</h1>
          <p className="text-gray-600">{t('admin.groups.subtitle')}</p>
        </div>
        {isSuperAdmin && (
          <button onClick={() => setModalOpen(true)} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-5 h-5" />
            {t('admin.groups.newGroup')}
          </button>
        )}
      </div>

      {/* Groups grid */}
      {groups.length === 0 ? (
        <div className="card text-center py-12">
          <FolderTree className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">{t('admin.groups.noGroups')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('admin.groups.createFirst')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              onEdit={(g) => setEditingGroup(g)}
              onDelete={(id) => deleteMutation.mutate(id)}
              users={usersData?.data || []}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
        </div>
      )}

      {/* Create/edit group modal */}
      {(modalOpen || editingGroup) && (
        <GroupModal
          group={editingGroup}
          onClose={() => { setModalOpen(false); setEditingGroup(null) }}
          onSave={handleSave}
          appDefaults={appDefaults}
        />
      )}
    </div>
  )
}
