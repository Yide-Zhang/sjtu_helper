import React from 'react';
import { Modal, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  icon?: string;
  iconColor?: string;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  /** 简单提示模式：只有一个确定按钮 */
  simple?: boolean;
  loading?: boolean;
}

interface AlertModalProps {
  visible: boolean;
  options: AlertOptions;
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({ visible, options, onClose }) => {
  const { icon, iconColor, title, message, buttons, simple, loading } = options;

  const handleButtonPress = (btn: AlertButton) => {
    if (btn.onPress) btn.onPress();
    if (btn.style !== 'cancel') onClose();
  };

  const defaultOkButton: AlertButton = { text: '确定', onPress: onClose };

  const renderButtons = () => {
    const btns = simple
      ? [defaultOkButton]
      : (buttons && buttons.length > 0 ? buttons : [defaultOkButton]);

    return (
      <View style={styles.modalButtons}>
        {btns.map((btn, i) => {
          const isCancel = btn.style === 'cancel';
          const isDestructive = btn.style === 'destructive';
          return (
            <TouchableOpacity
              key={i}
              style={[
                isCancel ? styles.modalCancelBtn : styles.modalConfirmBtn,
                isDestructive && { backgroundColor: '#E53935' },
              ]}
              onPress={() => handleButtonPress(btn)}
              activeOpacity={0.7}
            >
              <Text style={isCancel ? styles.modalCancelText : styles.modalConfirmText}>
                {btn.text}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const resolvedIcon = icon || (simple ? 'check-circle' : 'info-outline');
  const resolvedIconColor = iconColor || (simple ? '#43A047' : '#0055A8');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {loading ? (
            <>
              <ActivityIndicator size="large" color="#0055A8" style={{ marginBottom: 16 }} />
              <Text style={styles.modalTitle}>{title}</Text>
              {message ? <Text style={styles.modalDesc}>{message}</Text> : null}
            </>
          ) : (
            <>
              <MaterialIcons
                name={resolvedIcon}
                size={48}
                color={resolvedIconColor}
                style={{ marginBottom: 12 }}
              />
              <Text style={styles.modalTitle}>{title}</Text>
              {message ? <Text style={styles.modalDesc}>{message}</Text> : null}
              {renderButtons()}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

export function useAlertModal() {
  const [visible, setVisible] = React.useState(false);
  const [options, setOptions] = React.useState<AlertOptions>({ title: '' });

  const showAlert = React.useCallback((opts: AlertOptions) => {
    setOptions(opts);
    setVisible(true);
  }, []);

  const hideAlert = React.useCallback(() => {
    setVisible(false);
  }, []);

  const alertProps: AlertModalProps = {
    visible,
    options,
    onClose: hideAlert,
  };

  return { showAlert, hideAlert, alertProps };
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    maxWidth: 300,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalDesc: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  modalCancelText: {
    fontSize: 15,
    color: '#999',
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    backgroundColor: '#0055A8',
  },
  modalConfirmText: {
    fontSize: 15,
    color: '#FFF',
    fontWeight: '600',
  },
});
