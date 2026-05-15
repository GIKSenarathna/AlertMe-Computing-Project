import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, SafeAreaView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useLanguage } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import i18n from "../i18n/i18n";

const CONTACTS_KEY = "emergencyContacts";

export default function EmergencyContactsScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { locale } = useLanguage();
  const styles = getStyles(theme);

  const [contacts, setContacts] = useState<any[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRelation, setNewRelation] = useState("");
  const [showRelationPicker, setShowRelationPicker] = useState(false);

  const RELATION_OPTIONS = [
    "Parent", "Spouse", "Sibling", "Child", "Friend", "Doctor", "Colleague", "Other"
  ];

  // Load contacts from AsyncStorage on mount
  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem(CONTACTS_KEY);
      if (saved) {
        setContacts(JSON.parse(saved));
        return;
      }
      // If no list yet, check if setup saved a primary emergency contact
      const primary = await AsyncStorage.getItem("primaryEmergencyContact");
      if (primary) {
        const c = JSON.parse(primary);
        const initialList = [{
          id: "1",
          name: c.name,
          phone: c.phone,
          email: "",
          relation: c.relationship || "Emergency Contact",
          notifications: true,
        }];
        setContacts(initialList);
        await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(initialList));
      }
    };
    load();
  }, []);

  const saveContacts = async (updated: any[]) => {
    setContacts(updated);
    await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(updated));
  };

  const handleDelete = (id: string) => {
    saveContacts(contacts.filter((c) => c.id !== id));
  };

  const toggleNotification = (id: string) => {
    saveContacts(contacts.map((c) => c.id === id ? { ...c, notifications: !c.notifications } : c));
  };

  const handleEditContact = (item: any) => {
    setEditingId(item.id);
    setNewName(item.name);
    setNewPhone(item.phone);
    setNewEmail(item.email || "");
    setNewRelation(item.relation);
    setModalVisible(true);
  };

  const handleAddContact = () => {
    if (newName && newPhone && newRelation) {
      let updated;
      if (editingId) {
        // Edit mode
        updated = contacts.map(c => c.id === editingId ? {
          ...c,
          name: newName,
          phone: newPhone,
          email: newEmail,
          relation: newRelation,
        } : c);
      } else {
        // Add mode
        updated = [...contacts, {
          id: Date.now().toString(),
          name: newName,
          phone: newPhone,
          email: newEmail,
          relation: newRelation,
          notifications: true,
        }];
      }
      saveContacts(updated);
      closeModal();
    }
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
    setNewName("");
    setNewPhone("");
    setNewEmail("");
    setNewRelation("");
  };

  const renderItem = ({ item }: any) => (
    <View style={styles.contactCard}>
      <View style={styles.contactHeaderRow}>
        <Text style={styles.contactName}>{item.name}</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.editBtn} onPress={() => handleEditContact(item)}>
            <Ionicons name="pencil-outline" size={20} color={theme.colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)}>
            <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.infoRow}>
        <Ionicons name="people-outline" size={16} color={theme.colors.textMuted} style={{ marginRight: 6 }} />
        <Text style={styles.relationText}>
          {item.relation === "relationSpouse" || item.relation === "relationParent"
            ? i18n.t(item.relation, { locale })
            : item.relation}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Ionicons name="call-outline" size={16} color={theme.colors.textMuted} />
        <Text style={styles.contactPhone}>{item.phone}</Text>
      </View>
      {item.email ? (
        <View style={styles.infoRow}>
          <Ionicons name="mail-outline" size={16} color={theme.colors.textMuted} />
          <Text style={styles.contactPhone}>{item.email}</Text>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.notificationRow}>
        <View style={styles.notifLabelArea}>
          <Ionicons name="notifications-outline" size={18} color={theme.colors.success} />
          <Text style={styles.notifText}>{i18n.t("notifications")}</Text>
        </View>
        <Switch
          trackColor={{ false: "#d1d1d1", true: theme.colors.primary }}
          thumbColor={"#fff"}
          onValueChange={() => toggleNotification(item.id)}
          value={item.notifications}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.headerText} />
        </TouchableOpacity>
        <Text style={styles.headerText}>{i18n.t("back", { locale })}</Text>
      </View>
      <View style={styles.headerTitleBox}>
        <Text style={styles.headerTitle}>{i18n.t("contacts", { locale })}</Text>
        <Text style={styles.headerSubtitle}>{i18n.t("contactsPageSubtitle", { locale })}</Text>
      </View>

      <View style={styles.container}>
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={64} color={theme.colors.textMuted} />
              <Text style={styles.emptyStateText}>{i18n.t("noContactsYet", { locale })}</Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.addBtn} onPress={() => {
          setEditingId(null);
          setNewName("");
          setNewPhone("");
          setNewEmail("");
          setNewRelation("");
          setModalVisible(true);
        }}>
          <Ionicons name="person-add-outline" size={20} color={theme.colors.buttonText} />
          <Text style={styles.addBtnText}>{i18n.t("addEmergencyContact", { locale })}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? i18n.t("edit", { locale }) || "Edit Contact" : i18n.t("addContactModalTitle", { locale })}</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeBtn}>
                <Ionicons name="close" size={24} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>{i18n.t("nameLabel", { locale })} *</Text>
            <TextInput style={styles.input} placeholderTextColor={theme.colors.textMuted} placeholder={i18n.t("namePlaceholder", { locale })} value={newName} onChangeText={setNewName} />

            <Text style={styles.inputLabel}>{i18n.t("phoneLabel", { locale })} *</Text>
            <TextInput style={styles.input} placeholderTextColor={theme.colors.textMuted} placeholder={i18n.t("phonePlaceholder", { locale })} value={newPhone} onChangeText={setNewPhone} keyboardType="phone-pad" />

            <Text style={styles.inputLabel}>{i18n.t("emailLabel", { locale })}</Text>
            <TextInput style={styles.input} placeholderTextColor={theme.colors.textMuted} placeholder={i18n.t("emailPlaceholder", { locale })} value={newEmail} onChangeText={setNewEmail} keyboardType="email-address" />

            <Text style={styles.inputLabel}>{i18n.t("relationshipLabel", { locale })} *</Text>
            <TouchableOpacity 
              style={[styles.input, { justifyContent: 'center' }]} 
              onPress={() => setShowRelationPicker(true)}
            >
              <Text style={{ color: newRelation ? theme.colors.text : theme.colors.textMuted }}>
                {newRelation || i18n.t("relationshipPlaceholder", { locale }) || "Select Relationship"}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.colors.textMuted} style={{ position: 'absolute', right: 16 }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalAddBtn, (!newName || !newPhone || !newRelation) && styles.modalAddBtnDisabled]}
              onPress={handleAddContact}
              disabled={!newName || !newPhone || !newRelation}
            >
              <Text style={styles.modalAddBtnText}>{editingId ? i18n.t("saveChanges", { locale }) || "Save Changes" : i18n.t("addContact")}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Relationship Picker Modal */}
      <Modal
        visible={showRelationPicker}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowRelationPicker(false)}
      >
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setShowRelationPicker(false)}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Relationship</Text>
            <FlatList
              data={RELATION_OPTIONS}
              keyExtractor={item => item}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.pickerItem} 
                  onPress={() => {
                    setNewRelation(item);
                    setShowRelationPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, newRelation === item && { color: theme.colors.primary, fontWeight: 'bold' }]}>
                    {item}
                  </Text>
                  {newRelation === item && <Ionicons name="checkmark" size={20} color={theme.colors.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.headerBg, paddingTop: Platform.OS === "android" ? 40 : 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingBottom: 8,
    backgroundColor: theme.colors.headerBg,
  },
  backBtn: { marginRight: 8 },
  headerText: { color: theme.colors.headerText, fontSize: 16, fontWeight: '500' },
  headerTitleBox: { paddingHorizontal: 20, paddingBottom: 20, backgroundColor: theme.colors.headerBg },
  headerTitle: { fontSize: 24, fontWeight: "bold", color: theme.colors.headerText, marginBottom: 6 },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.9)" },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 16,
  },
  listContent: { padding: 16, paddingBottom: 100 },
  contactCard: {
    backgroundColor: theme.colors.card,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  contactHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  contactName: { fontSize: 18, fontWeight: "bold", color: theme.colors.primary },
  actionButtons: { flexDirection: 'row', gap: 12 },
  editBtn: { padding: 4 },
  deleteBtn: { padding: 4 },
  relationText: { fontSize: 14, color: theme.colors.textMuted, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  contactPhone: { fontSize: 14, color: theme.colors.text },
  divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 12 },
  notificationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notifLabelArea: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notifText: { fontSize: 14, color: theme.colors.text, fontWeight: '500' },
  emptyState: { alignItems: "center", marginTop: 60 },
  emptyStateText: { fontSize: 16, color: theme.colors.textMuted, marginTop: 16 },
  addBtn: {
    flexDirection: "row",
    position: "absolute",
    bottom: 24,
    left: 24,
    right: 24,
    backgroundColor: theme.colors.buttonBg,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
    gap: 8,
  },
  addBtnText: { color: theme.colors.buttonText, fontSize: 16, fontWeight: "bold" },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    width: '100%',
    borderRadius: 16,
    padding: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: theme.colors.primary },
  closeBtn: { padding: 4 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text, marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.inputBg ?? (theme.isDark ? "#0c1021" : "#f8fafc"),
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    marginBottom: 16,
    color: theme.colors.text,
  },
  modalAddBtn: {
    backgroundColor: theme.colors.buttonBg,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  modalAddBtnDisabled: { backgroundColor: theme.colors.border },
  modalAddBtnText: { color: theme.colors.buttonText, fontSize: 16, fontWeight: 'bold' },
  
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '60%',
  },
  pickerTitle: { fontSize: 16, fontWeight: 'bold', color: theme.colors.text, marginBottom: 16, textAlign: 'center' },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerItemText: { fontSize: 16, color: theme.colors.text },
});