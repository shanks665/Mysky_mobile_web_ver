import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { useAuth } from '../../contexts/AuthContext';
import { theme } from '../../styles/theme';
import { DEFAULT_PROFILE_IMAGE, DEFAULT_COVER_IMAGE } from '../../utils/defaultImages';
import PrefectureSelector from '../../components/PrefectureSelector';
import { getLocationString } from '../../utils/prefectureData';

const EditProfileScreen: React.FC = () => {
  const { user, updateProfile } = useAuth();
  const navigation = useNavigation();
  
  const [nickname, setNickname] = useState(user?.nickname || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [prefecture, setPrefecture] = useState(user?.prefecture || '');
  const [city, setCity] = useState(user?.city || '');
  const [profilePhoto, setProfilePhoto] = useState(user?.profilePhoto || DEFAULT_PROFILE_IMAGE);
  const [coverPhoto, setCoverPhoto] = useState(user?.coverPhoto || DEFAULT_COVER_IMAGE);
  const [accountPrivacy, setAccountPrivacy] = useState(user?.accountPrivacy || 'public');
  const [loading, setLoading] = useState(false);
  const [showPrefectureSelector, setShowPrefectureSelector] = useState(false);
  
  // 画像選択ハンドラー
  const handleSelectImage = async (type: 'profile' | 'cover') => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });
    
    if (result.assets && result.assets.length > 0) {
      const selectedImage = result.assets[0];
      if (selectedImage.uri) {
        if (type === 'profile') {
          setProfilePhoto(selectedImage.uri);
        } else {
          setCoverPhoto(selectedImage.uri);
        }
      }
    }
  };
  
  // 画像アップロード関数
  const uploadImage = async (uri: string, path: string): Promise<string> => {
    if (uri.startsWith('http')) {
      return uri; // すでにアップロード済みの画像はそのまま返す
    }
    
    const filename = uri.substring(uri.lastIndexOf('/') + 1);
    const storageRef = storage().ref(`${path}/${filename}`);
    
    const task = storageRef.putFile(uri);
    await task;
    
    return await storageRef.getDownloadURL();
  };
  
  // プロフィール更新ハンドラー
  const handleUpdateProfile = async () => {
    if (!user) {
      Alert.alert('エラー', 'ユーザー情報が取得できません');
      return;
    }
    
    if (!nickname.trim()) {
      Alert.alert('エラー', 'ニックネームを入力してください');
      return;
    }
    
    setLoading(true);
    
    try {
      let profilePhotoUrl = profilePhoto;
      let coverPhotoUrl = coverPhoto;
      
      // 画像のアップロード
      if (profilePhoto && !profilePhoto.startsWith('http')) {
        profilePhotoUrl = await uploadImage(profilePhoto, `users/${user.id}/profile`);
      }
      
      if (coverPhoto && !coverPhoto.startsWith('http')) {
        coverPhotoUrl = await uploadImage(coverPhoto, `users/${user.id}/cover`);
      }
      
      // ユーザープロフィールの更新
      const updatedProfile = {
        nickname,
        bio,
        gender,
        prefecture,
        city,
        profilePhoto: profilePhotoUrl,
        coverPhoto: coverPhotoUrl,
        accountPrivacy,
      };
      
      await updateProfile(updatedProfile);
      
      Alert.alert('成功', 'プロフィールを更新しました', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('エラー', 'プロフィールの更新に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePrefectureSelect = (prefectureId: string, cityId?: string) => {
    setPrefecture(prefectureId);
    if (cityId) {
      setCity(cityId);
    } else {
      setCity('');
    }
  };
  
  return (
    <ScrollView style={styles.container}>
      {/* カバー写真 */}
      <View style={styles.coverContainer}>
        <Image
          source={{ uri: coverPhoto || DEFAULT_COVER_IMAGE }}
          style={styles.coverPhoto}
        />
        <TouchableOpacity
          style={styles.editCoverButton}
          onPress={() => handleSelectImage('cover')}
        >
          <Icon name="image" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {/* プロフィール写真 */}
      <View style={styles.profilePhotoContainer}>
        <Image
          source={{ uri: profilePhoto || DEFAULT_PROFILE_IMAGE }}
          style={styles.profilePhoto}
        />
        <TouchableOpacity
          style={styles.editProfileButton}
          onPress={() => handleSelectImage('profile')}
        >
          <Icon name="person" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
      
      {/* フォーム */}
      <View style={styles.formContainer}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>ニックネーム</Text>
          <TextInput
            style={styles.input}
            value={nickname}
            onChangeText={setNickname}
            placeholder="ニックネームを入力"
            placeholderTextColor={theme.colors.text.secondary}
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>自己紹介</Text>
          <TextInput
            style={[styles.input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="自己紹介を入力"
            placeholderTextColor={theme.colors.text.secondary}
            multiline
          />
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>性別</Text>
          <View style={styles.radioContainer}>
            <TouchableOpacity
              style={[
                styles.radioOption,
                gender === 'male' && styles.selectedGender
              ]}
              onPress={() => setGender('male')}
            >
              <View style={[
                styles.radioButton,
                gender === 'male' && styles.radioButtonSelected
              ]}>
                {gender === 'male' && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={gender === 'male' ? styles.selectedGenderText : styles.genderText}>男性</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.radioOption,
                gender === 'female' && styles.selectedGender
              ]}
              onPress={() => setGender('female')}
            >
              <View style={[
                styles.radioButton,
                gender === 'female' && styles.radioButtonSelected
              ]}>
                {gender === 'female' && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={gender === 'female' ? styles.selectedGenderText : styles.genderText}>女性</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.radioOption,
                gender === 'other' && styles.selectedGender
              ]}
              onPress={() => setGender('other')}
            >
              <View style={[
                styles.radioButton,
                gender === 'other' && styles.radioButtonSelected
              ]}>
                {gender === 'other' && <View style={styles.radioButtonInner} />}
              </View>
              <Text style={gender === 'other' ? styles.selectedGenderText : styles.genderText}>その他</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>居住地</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setShowPrefectureSelector(true)}
          >
            <Text style={[
              styles.inputText,
              !prefecture && { color: theme.colors.text.secondary }
            ]}>
              {prefecture ? getLocationString(prefecture, city) : '都道府県・市区町村を選択'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <PrefectureSelector
          visible={showPrefectureSelector}
          onClose={() => setShowPrefectureSelector(false)}
          onSelect={handlePrefectureSelect}
          initialPrefectureId={prefecture}
          initialCityId={city}
        />
        
        <View style={styles.inputContainer}>
          <Text style={styles.label}>アカウントプライバシー</Text>
          <View style={styles.privacyContainer}>
            <TouchableOpacity
              style={[
                styles.privacyOption,
                accountPrivacy === 'public' && styles.selectedPrivacy,
              ]}
              onPress={() => setAccountPrivacy('public')}
            >
              <Icon name="lock-open-outline" size={20} color={accountPrivacy === 'public' ? theme.colors.primary : theme.colors.text.secondary} />
              <Text style={accountPrivacy === 'public' ? styles.selectedPrivacyText : styles.privacyText}>オープン</Text>
              <Text style={styles.privacyDescription}>誰でもフォローやメッセージ送信が可能</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.privacyOption,
                accountPrivacy === 'private' && styles.selectedPrivacy,
              ]}
              onPress={() => setAccountPrivacy('private')}
            >
              <Icon name="lock-closed-outline" size={20} color={accountPrivacy === 'private' ? theme.colors.primary : theme.colors.text.secondary} />
              <Text style={accountPrivacy === 'private' ? styles.selectedPrivacyText : styles.privacyText}>鍵付き</Text>
              <Text style={styles.privacyDescription}>フォロー承認後のみメッセージ送信が可能</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <TouchableOpacity
          style={[styles.updateButton, loading && styles.updateButtonDisabled]}
          onPress={handleUpdateProfile}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.updateButtonText}>プロフィールを更新</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  coverContainer: {
    height: 150,
    position: 'relative',
  },
  coverPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  editCoverButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  profilePhotoContainer: {
    alignItems: 'center',
    marginTop: -50,
  },
  profilePhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: theme.colors.background,
  },
  editProfileButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 15,
    padding: 6,
  },
  formContainer: {
    padding: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  inputText: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  locationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  locationInput: {
    flex: 1,
    marginRight: 8,
  },
  radioContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.colors.text.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: theme.colors.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  radioLabel: {
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  selectedGender: {
    backgroundColor: `${theme.colors.primary}10`,
    borderRadius: 8,
  },
  genderText: {
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  selectedGenderText: {
    marginLeft: 8,
    fontSize: 16,
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  privacyContainer: {
    marginTop: 8,
  },
  privacyOption: {
    flexDirection: 'column',
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedPrivacy: {
    borderColor: theme.colors.primary,
    backgroundColor: `${theme.colors.primary}10`,
  },
  privacyText: {
    fontSize: 16,
    color: theme.colors.text.primary,
    marginTop: 4,
    fontWeight: 'bold',
  },
  selectedPrivacyText: {
    fontSize: 16,
    color: theme.colors.primary,
    marginTop: 4,
    fontWeight: 'bold',
  },
  privacyDescription: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 4,
  },
  updateButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  updateButtonDisabled: {
    opacity: 0.5,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default EditProfileScreen;